import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

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
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Use environment variable or default to data directory
    const dataDir = process.env.SQLITE_DATA_DIR || './data';

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'nostr.db');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
      console.log(`Loaded existing database from ${this.dbPath}`);
    } else {
      this.db = new SQL.Database();
      console.log(`Created new database at ${this.dbPath}`);
    }

    // Create events table and indexes
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        kind INTEGER NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        sig TEXT NOT NULL,
        received_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
      CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
      CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);
    `);

    // Save database periodically (every 30 seconds)
    this.saveInterval = setInterval(() => {
      this.saveToDisk();
    }, 30000);

    console.log(`Database initialized at ${this.dbPath}`);
  }

  private saveToDisk(): void {
    if (!this.db) return;

    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('Error saving database to disk:', error);
    }
  }

  async saveEvent(event: NostrEvent): Promise<boolean> {
    if (!this.db) return false;

    try {
      this.db.run(
        `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
    if (!this.db || !filters || filters.length === 0) {
      return [];
    }

    const events: NostrEvent[] = [];

    for (const filter of filters) {
      const conditions: string[] = [];
      const params: any[] = [];

      // Filter by IDs
      if (filter.ids && filter.ids.length > 0) {
        const placeholders = filter.ids.map(() => '?').join(',');
        conditions.push(`id IN (${placeholders})`);
        params.push(...filter.ids);
      }

      // Filter by authors
      if (filter.authors && filter.authors.length > 0) {
        const placeholders = filter.authors.map(() => '?').join(',');
        conditions.push(`pubkey IN (${placeholders})`);
        params.push(...filter.authors);
      }

      // Filter by kinds
      if (filter.kinds && filter.kinds.length > 0) {
        const placeholders = filter.kinds.map(() => '?').join(',');
        conditions.push(`kind IN (${placeholders})`);
        params.push(...filter.kinds);
      }

      // Filter by since
      if (filter.since) {
        conditions.push(`created_at >= ?`);
        params.push(filter.since);
      }

      // Filter by until
      if (filter.until) {
        conditions.push(`created_at <= ?`);
        params.push(filter.until);
      }

      // Filter by tags (e.g., #e, #p)
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith('#') && Array.isArray(values)) {
          const tagName = key.substring(1);
          // SQLite JSON search - check if tags array contains matching tag
          for (const value of values) {
            conditions.push(`tags LIKE ?`);
            params.push(`%["${tagName}","${value}"%`);
          }
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

      const stmt = this.db.prepare(query);
      stmt.bind(params);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        events.push({
          id: row.id as string,
          pubkey: row.pubkey as string,
          created_at: row.created_at as number,
          kind: row.kind as number,
          tags: JSON.parse(row.tags as string),
          content: row.content as string,
          sig: row.sig as string,
        });
      }

      stmt.free();
    }

    return events;
  }

  async close(): Promise<void> {
    // Clear save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Final save to disk
    this.saveToDisk();

    // Close database
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
