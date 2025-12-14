-- Minimoonoir D1 Database Schema
-- Whitelist and Cohort-Based Access Control for Private Relay

-- Whitelist table for relay access control
CREATE TABLE IF NOT EXISTS whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts TEXT NOT NULL,  -- JSON array of cohort types: ["admin"], ["business"], ["moomaa-tribe"]
  added_at INTEGER NOT NULL,
  added_by TEXT NOT NULL,
  expires_at INTEGER,  -- NULL means never expires
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Index for efficient expiry checks
CREATE INDEX IF NOT EXISTS idx_whitelist_expires ON whitelist(expires_at);

-- Channels table for NIP-28 chat rooms
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cohorts TEXT NOT NULL,  -- JSON array: which cohorts can access this channel
  visibility TEXT NOT NULL DEFAULT 'listed',  -- 'listed', 'unlisted', 'private'
  admin_pubkey TEXT NOT NULL,
  event_id TEXT,  -- Nostr event ID that created this channel
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for channel lookups
CREATE INDEX IF NOT EXISTS idx_channels_visibility ON channels(visibility);

-- Channel members table (for private channels)
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  pubkey TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- 'member', 'moderator', 'admin'
  joined_at INTEGER DEFAULT (unixepoch()),
  invited_by TEXT,
  PRIMARY KEY (channel_id, pubkey),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Calendar events table for NIP-52
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,  -- Nostr event ID
  pubkey TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  location TEXT,
  geohash TEXT,
  cohorts TEXT NOT NULL,  -- JSON array: which cohorts can see this event
  kind INTEGER NOT NULL,  -- 31922 (date-based) or 31923 (time-based)
  d_tag TEXT,  -- Parameterized replaceable event identifier
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_pubkey ON calendar_events(pubkey);
CREATE INDEX IF NOT EXISTS idx_calendar_kind ON calendar_events(kind);

-- Calendar RSVPs table for NIP-52
CREATE TABLE IF NOT EXISTS calendar_rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,  -- References calendar_events.event_id
  pubkey TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'accepted', 'declined', 'tentative'
  nostr_event_id TEXT,  -- The RSVP Nostr event ID
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(event_id, pubkey)
);

-- Index for RSVP lookups
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON calendar_rsvps(event_id);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Initialize default admin settings
INSERT OR IGNORE INTO admin_settings (key, value) VALUES
  ('relay_name', 'Minimoonoir Private Relay'),
  ('relay_description', 'A private community relay for Minimoonoir'),
  ('admin_pubkey', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2'),
  ('auth_required', 'true'),
  ('external_sync_enabled', 'false'),
  ('max_event_size', '65536'),
  ('max_subscriptions_per_connection', '20');

-- Cohort definitions table
CREATE TABLE IF NOT EXISTS cohorts (
  name TEXT PRIMARY KEY,
  description TEXT,
  permissions TEXT NOT NULL,  -- JSON object of permissions
  created_at INTEGER DEFAULT (unixepoch())
);

-- Initialize default cohorts
INSERT OR IGNORE INTO cohorts (name, description, permissions) VALUES
  ('admin', 'Administrators with full access', '{"read":true,"write":true,"delete":true,"manage_users":true,"manage_channels":true,"manage_events":true}'),
  ('business', 'Business community members', '{"read":true,"write":true,"delete_own":true,"create_channels":false,"create_events":true}'),
  ('moomaa-tribe', 'Moomaa tribe community members', '{"read":true,"write":true,"delete_own":true,"create_channels":false,"create_events":true}');

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor_pubkey TEXT NOT NULL,
  target_pubkey TEXT,
  target_type TEXT,  -- 'user', 'channel', 'event', 'setting'
  target_id TEXT,
  details TEXT,  -- JSON object with action details
  created_at INTEGER DEFAULT (unixepoch())
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_pubkey);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
