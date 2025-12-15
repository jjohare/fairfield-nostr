-- Nostr Relay Database Schema
-- PostgreSQL 16+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    kind INTEGER NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    content TEXT NOT NULL,
    sig TEXT NOT NULL,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted) WHERE NOT deleted;

-- Tag indexes using GIN for JSONB
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN (tags);

-- Full-text search on content
CREATE INDEX IF NOT EXISTS idx_events_content_search ON events USING GIN (to_tsvector('english', content));

-- Cohorts table for access control
CREATE TABLE IF NOT EXISTS cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    allowed_pubkeys TEXT[] DEFAULT '{}',
    allowed_kinds INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cohorts_name ON cohorts(name);
CREATE INDEX IF NOT EXISTS idx_cohorts_expires_at ON cohorts(expires_at) WHERE expires_at IS NOT NULL;

-- Session authentication table
CREATE TABLE IF NOT EXISTS authenticated_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pubkey TEXT NOT NULL,
    challenge TEXT NOT NULL,
    authenticated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_pubkey ON authenticated_sessions(pubkey);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON authenticated_sessions(expires_at);

-- Deletions tracking (NIP-09)
CREATE TABLE IF NOT EXISTS deletions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deletion_event_id TEXT NOT NULL,
    deleted_event_id TEXT NOT NULL,
    deleter_pubkey TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    kind INTEGER NOT NULL,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deletions_deleted_event ON deletions(deleted_event_id);
CREATE INDEX IF NOT EXISTS idx_deletions_deleter_pubkey ON deletions(deleter_pubkey);

-- Payment records (for pay-to-relay)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pubkey TEXT NOT NULL,
    amount_sats BIGINT NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    payment_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_payments_pubkey ON payments(pubkey);
CREATE INDEX IF NOT EXISTS idx_payments_expires ON payments(expires_at) WHERE expires_at IS NOT NULL;

-- NIP-05 verification cache
CREATE TABLE IF NOT EXISTS nip05_verifications (
    pubkey TEXT PRIMARY KEY,
    nip05_address TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nip05_address ON nip05_verifications(nip05_address);
CREATE INDEX IF NOT EXISTS idx_nip05_verified ON nip05_verifications(verified) WHERE verified = TRUE;

-- Relay statistics
CREATE TABLE IF NOT EXISTS relay_stats (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_events BIGINT,
    total_users BIGINT,
    events_per_minute DECIMAL,
    active_subscriptions INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_relay_stats_timestamp ON relay_stats(timestamp DESC);

-- Calendar events (NIP-52)
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    location TEXT,
    geohash TEXT,
    cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_cohort ON calendar_events(cohort_id) WHERE cohort_id IS NOT NULL;

-- Chatrooms linked to calendar events
CREATE TABLE IF NOT EXISTS event_chatrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    chatroom_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calendar_event_id, chatroom_event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_chatrooms_calendar ON event_chatrooms(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_event_chatrooms_chatroom ON event_chatrooms(chatroom_event_id);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM authenticated_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as deleted
CREATE OR REPLACE FUNCTION mark_event_deleted(event_id_param TEXT)
RETURNS void AS $$
BEGIN
    UPDATE events SET deleted = TRUE WHERE id = event_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get events by filter
CREATE OR REPLACE FUNCTION query_events(
    p_ids TEXT[] DEFAULT NULL,
    p_authors TEXT[] DEFAULT NULL,
    p_kinds INTEGER[] DEFAULT NULL,
    p_since BIGINT DEFAULT NULL,
    p_until BIGINT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    pubkey TEXT,
    created_at BIGINT,
    kind INTEGER,
    tags JSONB,
    content TEXT,
    sig TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.pubkey, e.created_at, e.kind, e.tags, e.content, e.sig
    FROM events e
    WHERE
        NOT e.deleted
        AND (p_ids IS NULL OR e.id = ANY(p_ids))
        AND (p_authors IS NULL OR e.pubkey = ANY(p_authors))
        AND (p_kinds IS NULL OR e.kind = ANY(p_kinds))
        AND (p_since IS NULL OR e.created_at >= p_since)
        AND (p_until IS NULL OR e.created_at <= p_until)
        AND (p_search IS NULL OR to_tsvector('english', e.content) @@ plainto_tsquery('english', p_search))
    ORDER BY e.created_at DESC
    LIMIT LEAST(p_limit, 5000);
END;
$$ LANGUAGE plpgsql;

-- Insert default cohort for testing
INSERT INTO cohorts (name, description, allowed_kinds)
VALUES ('public', 'Public access cohort', ARRAY[0,1,2,3,4,5,6,7,40,41,42])
ON CONFLICT (name) DO NOTHING;

-- Commit
COMMIT;
