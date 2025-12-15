-- SQLite schema for Nostr relay
-- This file is for reference only - the database is created automatically by db.ts

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

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);

-- Notes:
-- - tags is stored as JSON text (serialized array)
-- - received_at is stored as Unix timestamp (seconds since epoch)
-- - created_at is also Unix timestamp from Nostr event
