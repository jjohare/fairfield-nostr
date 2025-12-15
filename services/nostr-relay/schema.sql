-- PostgreSQL Database Schema for Nostr Relay
-- Supports NIP-01, NIP-28 (channels), NIP-52 (calendar events), and cohort-based access control
-- Optimized for performance with proper indexing and partitioning support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- ============================================================================
-- WHITELIST & ACCESS CONTROL
-- ============================================================================

-- Whitelist table for relay access control
CREATE TABLE IF NOT EXISTS whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of cohort types: ["admin"], ["business"], ["moomaa-tribe"]
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ,  -- NULL means never expires
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for whitelist
CREATE INDEX IF NOT EXISTS idx_whitelist_expires ON whitelist(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whitelist_cohorts ON whitelist USING GIN(cohorts);
CREATE INDEX IF NOT EXISTS idx_whitelist_added_by ON whitelist(added_by);

-- ============================================================================
-- NOSTR EVENTS (NIP-01)
-- ============================================================================

-- Main events table supporting all Nostr event kinds
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,  -- Event ID (hex-encoded sha256)
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sig TEXT NOT NULL,

  -- Metadata
  received_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE,

  -- Constraints
  CONSTRAINT valid_event_id CHECK (length(id) = 64),
  CONSTRAINT valid_pubkey CHECK (length(pubkey) = 64),
  CONSTRAINT valid_signature CHECK (length(sig) = 128)
);

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_events_kind_created ON events(kind, created_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at DESC);

-- Partial index for replaceable events (kinds 0, 3, 10000-19999)
CREATE INDEX IF NOT EXISTS idx_events_replaceable ON events(pubkey, kind, created_at DESC)
  WHERE (kind = 0 OR kind = 3 OR (kind >= 10000 AND kind < 20000)) AND NOT deleted;

-- Partial index for parameterized replaceable events (kinds 30000-39999)
CREATE INDEX IF NOT EXISTS idx_events_param_replaceable ON events(pubkey, kind, ((tags->0->1)), created_at DESC)
  WHERE (kind >= 30000 AND kind < 40000) AND NOT deleted;

-- ============================================================================
-- EVENT TAGS (Optimized for Querying)
-- ============================================================================

-- Separate table for efficient tag-based queries
CREATE TABLE IF NOT EXISTS event_tags (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,  -- e.g., 'e', 'p', 'd', 'a'
  tag_value TEXT NOT NULL,
  tag_index INTEGER NOT NULL,  -- Position in tag array

  PRIMARY KEY (event_id, tag_name, tag_index)
);

-- Indexes for tag queries
CREATE INDEX IF NOT EXISTS idx_event_tags_name_value ON event_tags(tag_name, tag_value);
CREATE INDEX IF NOT EXISTS idx_event_tags_value ON event_tags(tag_value);
CREATE INDEX IF NOT EXISTS idx_event_tags_event ON event_tags(event_id);

-- ============================================================================
-- CHANNELS (NIP-28)
-- ============================================================================

-- Channels table for NIP-28 chat rooms
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Which cohorts can access this channel
  visibility TEXT NOT NULL DEFAULT 'listed' CHECK (visibility IN ('listed', 'unlisted', 'private')),
  admin_pubkey TEXT NOT NULL,
  event_id TEXT,  -- Nostr event ID that created this channel
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_channels_visibility ON channels(visibility);
CREATE INDEX IF NOT EXISTS idx_channels_admin ON channels(admin_pubkey);
CREATE INDEX IF NOT EXISTS idx_channels_cohorts ON channels USING GIN(cohorts);

-- Channel members table (for private channels)
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  pubkey TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT,

  PRIMARY KEY (channel_id, pubkey)
);

-- Indexes for channel members
CREATE INDEX IF NOT EXISTS idx_channel_members_pubkey ON channel_members(pubkey);
CREATE INDEX IF NOT EXISTS idx_channel_members_role ON channel_members(channel_id, role);

-- ============================================================================
-- CALENDAR EVENTS (NIP-52)
-- ============================================================================

-- Calendar events table for NIP-52
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,  -- Nostr event ID
  pubkey TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  geohash TEXT,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Which cohorts can see this event
  kind INTEGER NOT NULL CHECK (kind IN (31922, 31923)),  -- 31922 (date-based) or 31923 (time-based)
  d_tag TEXT,  -- Parameterized replaceable event identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time IS NULL OR end_time > start_time)
);

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_end ON calendar_events(end_time) WHERE end_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_pubkey ON calendar_events(pubkey);
CREATE INDEX IF NOT EXISTS idx_calendar_kind ON calendar_events(kind);
CREATE INDEX IF NOT EXISTS idx_calendar_cohorts ON calendar_events USING GIN(cohorts);
CREATE INDEX IF NOT EXISTS idx_calendar_d_tag ON calendar_events(d_tag) WHERE d_tag IS NOT NULL;

-- Calendar RSVPs table for NIP-52
CREATE TABLE IF NOT EXISTS calendar_rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,  -- References calendar_events.event_id
  pubkey TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'declined', 'tentative')),
  nostr_event_id TEXT,  -- The RSVP Nostr event ID
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, pubkey)
);

-- Indexes for RSVP lookups
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON calendar_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_pubkey ON calendar_rsvps(pubkey);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON calendar_rsvps(event_id, status);

-- ============================================================================
-- SESSION MANAGEMENT
-- ============================================================================

-- WebSocket sessions table for connection tracking
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pubkey TEXT,  -- NULL for unauthenticated connections
  connection_id TEXT NOT NULL UNIQUE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  subscription_count INTEGER DEFAULT 0,

  CONSTRAINT valid_subscription_count CHECK (subscription_count >= 0)
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_pubkey ON sessions(pubkey) WHERE pubkey IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_connected ON sessions(connected_at);

-- ============================================================================
-- RATE LIMITING
-- ============================================================================

-- Rate limits table for connection-based throttling
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT NOT NULL,  -- Can be pubkey, IP, or connection_id
  limit_type TEXT NOT NULL CHECK (limit_type IN ('message', 'event', 'subscription', 'auth')),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,

  PRIMARY KEY (identifier, limit_type, window_start)
);

-- Indexes for rate limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ============================================================================
-- COHORTS & PERMISSIONS
-- ============================================================================

-- Cohort definitions table
CREATE TABLE IF NOT EXISTS cohorts (
  name TEXT PRIMARY KEY,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cohort queries
CREATE INDEX IF NOT EXISTS idx_cohorts_permissions ON cohorts USING GIN(permissions);

-- ============================================================================
-- ADMIN & SETTINGS
-- ============================================================================

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor_pubkey TEXT NOT NULL,
  target_pubkey TEXT,
  target_type TEXT CHECK (target_type IN ('user', 'channel', 'event', 'setting', 'cohort')),
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_pubkey);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for channels table
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired whitelist entries
CREATE OR REPLACE FUNCTION clean_expired_whitelist()
RETURNS void AS $$
BEGIN
  DELETE FROM whitelist WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean old rate limit entries
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to clean inactive sessions
CREATE OR REPLACE FUNCTION clean_inactive_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE last_activity < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active connections
CREATE OR REPLACE VIEW active_sessions AS
SELECT
  s.id,
  s.pubkey,
  s.connection_id,
  s.ip_address,
  s.connected_at,
  s.last_activity,
  s.subscription_count,
  w.cohorts
FROM sessions s
LEFT JOIN whitelist w ON s.pubkey = w.pubkey
WHERE s.last_activity > NOW() - INTERVAL '1 hour';

-- View for event statistics
CREATE OR REPLACE VIEW event_stats AS
SELECT
  kind,
  COUNT(*) as event_count,
  COUNT(DISTINCT pubkey) as unique_authors,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM events
WHERE NOT deleted
GROUP BY kind;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE whitelist IS 'Access control list for relay with cohort-based permissions';
COMMENT ON TABLE events IS 'Main Nostr events table supporting all event kinds (NIP-01)';
COMMENT ON TABLE event_tags IS 'Denormalized tag storage for efficient queries';
COMMENT ON TABLE channels IS 'NIP-28 public chat channels with cohort-based access';
COMMENT ON TABLE calendar_events IS 'NIP-52 calendar events with cohort-based visibility';
COMMENT ON TABLE sessions IS 'WebSocket connection tracking and management';
COMMENT ON TABLE rate_limits IS 'Connection-based rate limiting and throttling';
COMMENT ON TABLE cohorts IS 'Cohort definitions with permission sets';
COMMENT ON TABLE audit_log IS 'Audit trail for administrative actions';
