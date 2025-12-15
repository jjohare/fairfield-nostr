import { Pool, QueryResult } from 'pg';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'nostr',
      user: process.env.POSTGRES_USER || 'nostr',
      password: process.env.POSTGRES_PASSWORD || 'nostr',
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(64) PRIMARY KEY,
        pubkey VARCHAR(64) NOT NULL,
        created_at BIGINT NOT NULL,
        kind INTEGER NOT NULL,
        tags JSONB NOT NULL,
        content TEXT NOT NULL,
        sig VARCHAR(128) NOT NULL,
        received_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
      CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
      CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tags ON events USING GIN(tags);
    `);
    console.log('Database initialized');
  }

  async saveEvent(event: NostrEvent): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig,
        ]
      );
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      return false;
    }
  }

  async queryEvents(filters: any[]): Promise<NostrEvent[]> {
    if (!filters || filters.length === 0) {
      return [];
    }

    const events: NostrEvent[] = [];

    for (const filter of filters) {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by IDs
      if (filter.ids && filter.ids.length > 0) {
        conditions.push(`id = ANY($${paramIndex})`);
        params.push(filter.ids);
        paramIndex++;
      }

      // Filter by authors
      if (filter.authors && filter.authors.length > 0) {
        conditions.push(`pubkey = ANY($${paramIndex})`);
        params.push(filter.authors);
        paramIndex++;
      }

      // Filter by kinds
      if (filter.kinds && filter.kinds.length > 0) {
        conditions.push(`kind = ANY($${paramIndex})`);
        params.push(filter.kinds);
        paramIndex++;
      }

      // Filter by since
      if (filter.since) {
        conditions.push(`created_at >= $${paramIndex}`);
        params.push(filter.since);
        paramIndex++;
      }

      // Filter by until
      if (filter.until) {
        conditions.push(`created_at <= $${paramIndex}`);
        params.push(filter.until);
        paramIndex++;
      }

      // Filter by tags (e.g., #e, #p)
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith('#') && Array.isArray(values)) {
          const tagName = key.substring(1);
          conditions.push(`tags @> $${paramIndex}::jsonb`);
          params.push(JSON.stringify([[tagName, ...values]]));
          paramIndex++;
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter.limit ? Math.min(filter.limit, 5000) : 500;

      const query = `
        SELECT id, pubkey, created_at, kind, tags, content, sig
        FROM events
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const result: QueryResult = await this.pool.query(query, params);

      for (const row of result.rows) {
        events.push({
          id: row.id,
          pubkey: row.pubkey,
          created_at: row.created_at,
          kind: row.kind,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
          content: row.content,
          sig: row.sig,
        });
      }
    }

    return events;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
