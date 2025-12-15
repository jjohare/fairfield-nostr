/**
 * Database connection and query interface
 */
import pg from 'pg';
import { config } from '../config.js';
import { NostrEvent, NostrFilter, StoredEvent } from '../types.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

class Database {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.connectionString,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connected successfully');
      client.release();
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    logger.info('Database disconnected');
  }

  /**
   * Store a new event
   */
  async storeEvent(event: NostrEvent): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;

      const result = await client.query(query, [
        event.id,
        event.pubkey,
        event.created_at,
        event.kind,
        JSON.stringify(event.tags),
        event.content,
        event.sig,
      ]);

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to store event', { eventId: event.id, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: NostrFilter[]): Promise<NostrEvent[]> {
    if (filters.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      const allEvents = new Map<string, NostrEvent>();

      for (const filter of filters) {
        const { query, values } = this.buildFilterQuery(filter);
        const result = await client.query<StoredEvent>(query, values);

        for (const row of result.rows) {
          if (!allEvents.has(row.id)) {
            allEvents.set(row.id, {
              id: row.id,
              pubkey: row.pubkey,
              created_at: row.created_at,
              kind: row.kind,
              tags: JSON.parse(row.tags),
              content: row.content,
              sig: row.sig,
            });
          }
        }
      }

      return Array.from(allEvents.values()).sort(
        (a, b) => b.created_at - a.created_at
      );
    } catch (error) {
      logger.error('Failed to query events', { error });
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Build SQL query from Nostr filter
   */
  private buildFilterQuery(filter: NostrFilter): { query: string; values: any[] } {
    const conditions: string[] = ['NOT deleted'];
    const values: any[] = [];
    let valueIndex = 1;

    if (filter.ids && filter.ids.length > 0) {
      conditions.push(`id = ANY($${valueIndex})`);
      values.push(filter.ids);
      valueIndex++;
    }

    if (filter.authors && filter.authors.length > 0) {
      conditions.push(`pubkey = ANY($${valueIndex})`);
      values.push(filter.authors);
      valueIndex++;
    }

    if (filter.kinds && filter.kinds.length > 0) {
      conditions.push(`kind = ANY($${valueIndex})`);
      values.push(filter.kinds);
      valueIndex++;
    }

    if (filter.since !== undefined) {
      conditions.push(`created_at >= $${valueIndex}`);
      values.push(filter.since);
      valueIndex++;
    }

    if (filter.until !== undefined) {
      conditions.push(`created_at <= $${valueIndex}`);
      values.push(filter.until);
      valueIndex++;
    }

    // Tag filters (e.g., #e, #p)
    for (const [key, tagValues] of Object.entries(filter)) {
      if (key.startsWith('#') && Array.isArray(tagValues) && tagValues.length > 0) {
        const tagName = key.substring(1);
        conditions.push(`
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(tags) AS tag
            WHERE tag->0 = $${valueIndex} AND tag->1 ?| $${valueIndex + 1}
          )
        `);
        values.push(JSON.stringify(tagName));
        values.push(tagValues);
        valueIndex += 2;
      }
    }

    // Full-text search
    if (filter.search) {
      conditions.push(`to_tsvector('english', content) @@ plainto_tsquery('english', $${valueIndex})`);
      values.push(filter.search);
      valueIndex++;
    }

    const limit = Math.min(filter.limit || 100, config.eventLimits.maxLimit);

    const query = `
      SELECT id, pubkey, created_at, kind, tags::text as tags, content, sig
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return { query, values };
  }

  /**
   * Delete an event (mark as deleted)
   */
  async deleteEvent(eventId: string, deleterPubkey: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership
      const checkQuery = 'SELECT pubkey FROM events WHERE id = $1 AND NOT deleted';
      const checkResult = await client.query(checkQuery, [eventId]);

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const eventPubkey = checkResult.rows[0].pubkey;
      if (eventPubkey !== deleterPubkey) {
        await client.query('ROLLBACK');
        logger.warn('Unauthorized deletion attempt', { eventId, deleterPubkey });
        return false;
      }

      // Mark as deleted
      const deleteQuery = 'UPDATE events SET deleted = TRUE WHERE id = $1';
      await client.query(deleteQuery, [eventId]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete event', { eventId, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Check if pubkey is in allowed cohort
   */
  async isPubkeyInCohort(pubkey: string, cohortName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 1 FROM cohorts
        WHERE name = $1
        AND (
          allowed_pubkeys = '{}'
          OR $2 = ANY(allowed_pubkeys)
        )
        AND (expires_at IS NULL OR expires_at > NOW())
      `;

      const result = await client.query(query, [cohortName, pubkey]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to check cohort access', { pubkey, cohortName, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Check if kind is allowed in cohort
   */
  async isKindAllowedInCohort(kind: number, cohortName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 1 FROM cohorts
        WHERE name = $1
        AND (
          allowed_kinds = '{}'
          OR $2 = ANY(allowed_kinds)
        )
      `;

      const result = await client.query(query, [cohortName, kind]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to check kind access', { kind, cohortName, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Store authentication session
   */
  async storeAuthSession(
    sessionId: string,
    pubkey: string,
    challenge: string,
    expiresAt: Date
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO authenticated_sessions (session_id, pubkey, challenge, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id) DO UPDATE
        SET pubkey = $2, authenticated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, [sessionId, pubkey, challenge, expiresAt]);
      return true;
    } catch (error) {
      logger.error('Failed to store auth session', { sessionId, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Verify authentication session
   */
  async verifyAuthSession(sessionId: string, pubkey: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 1 FROM authenticated_sessions
        WHERE session_id = $1 AND pubkey = $2 AND expires_at > NOW()
      `;

      const result = await client.query(query, [sessionId, pubkey]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to verify auth session', { sessionId, error });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get relay statistics
   */
  async getStats(): Promise<{
    totalEvents: number;
    totalUsers: number;
    recentEvents: number;
  }> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT
          COUNT(DISTINCT id) as total_events,
          COUNT(DISTINCT pubkey) as total_users,
          COUNT(*) FILTER (WHERE indexed_at > NOW() - INTERVAL '1 hour') as recent_events
        FROM events
        WHERE NOT deleted
      `;

      const result = await client.query(query);
      const row = result.rows[0];

      return {
        totalEvents: parseInt(row.total_events, 10),
        totalUsers: parseInt(row.total_users, 10),
        recentEvents: parseInt(row.recent_events, 10),
      };
    } catch (error) {
      logger.error('Failed to get stats', { error });
      return { totalEvents: 0, totalUsers: 0, recentEvents: 0 };
    } finally {
      client.release();
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM authenticated_sessions WHERE expires_at < NOW()'
      );
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
      return 0;
    } finally {
      client.release();
    }
  }
}

export const db = new Database();
