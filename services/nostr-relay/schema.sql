-- SQLite schema for Nostr relay (sql.js in-memory/file database)
-- REFERENCE ONLY - the database is created automatically by src/db.ts
--
-- Database: sql.js (SQLite compiled to WebAssembly)
-- Storage: File-based with periodic saves (./data/nostr.db)
-- Runtime: Node.js Cloud Run container

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags TEXT NOT NULL,          -- JSON-serialized string[][] array
  content TEXT NOT NULL,
  sig TEXT NOT NULL,
  received_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for query performance (NIP-01 filters)
CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);

-- Implementation Notes:
-- - Database persisted to ./data/nostr.db every 30 seconds
-- - Tags stored as JSON text for LIKE-based searching
-- - Tag queries use pattern: tags LIKE '%["tagname","value"%'
-- - Maximum 5000 events per query (limit enforced in db.ts:186)
-- - Whitelist/ACL managed via NIP-42 AUTH events, not SQL tables
