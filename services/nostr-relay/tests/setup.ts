/**
 * Global test setup and utilities
 */
import { Pool } from 'pg';

// Test database configuration
export const TEST_DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'nostr_relay_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

// Test relay configuration
export const TEST_RELAY_CONFIG = {
  host: process.env.RELAY_HOST || 'localhost',
  port: parseInt(process.env.RELAY_PORT || '8080'),
  wsUrl: process.env.RELAY_WS_URL || 'ws://localhost:8080',
};

let testPool: Pool | null = null;

/**
 * Get test database pool
 */
export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool(TEST_DB_CONFIG);
  }
  return testPool;
}

/**
 * Close test database pool
 */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Setup test database schema
 */
export async function setupTestDatabase(): Promise<void> {
  const pool = getTestPool();

  // Read and execute schema
  const schema = `
    -- Whitelist table for relay access control
    CREATE TABLE IF NOT EXISTS whitelist (
      pubkey TEXT PRIMARY KEY,
      cohorts TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      added_by TEXT NOT NULL,
      expires_at INTEGER,
      notes TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_whitelist_expires ON whitelist(expires_at);

    -- Channels table for NIP-28 chat rooms
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cohorts TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'listed',
      admin_pubkey TEXT NOT NULL,
      event_id TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_channels_visibility ON channels(visibility);

    -- Channel members table
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id TEXT NOT NULL,
      pubkey TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      invited_by TEXT,
      PRIMARY KEY (channel_id, pubkey),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );

    -- Calendar events table for NIP-52
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      pubkey TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      location TEXT,
      geohash TEXT,
      cohorts TEXT NOT NULL,
      kind INTEGER NOT NULL,
      d_tag TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_calendar_pubkey ON calendar_events(pubkey);
    CREATE INDEX IF NOT EXISTS idx_calendar_kind ON calendar_events(kind);

    -- Calendar RSVPs table
    CREATE TABLE IF NOT EXISTS calendar_rsvps (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      pubkey TEXT NOT NULL,
      status TEXT NOT NULL,
      nostr_event_id TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      UNIQUE(event_id, pubkey)
    );

    CREATE INDEX IF NOT EXISTS idx_rsvps_event ON calendar_rsvps(event_id);

    -- Cohorts table
    CREATE TABLE IF NOT EXISTS cohorts (
      name TEXT PRIMARY KEY,
      description TEXT,
      permissions TEXT NOT NULL,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    -- Events table for storing Nostr events
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      pubkey TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      kind INTEGER NOT NULL,
      tags JSONB NOT NULL,
      content TEXT NOT NULL,
      sig TEXT NOT NULL,
      indexed_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
    CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
  `;

  await pool.query(schema);
}

/**
 * Clean test database
 */
export async function cleanTestDatabase(): Promise<void> {
  const pool = getTestPool();

  await pool.query('TRUNCATE TABLE calendar_rsvps CASCADE');
  await pool.query('TRUNCATE TABLE calendar_events CASCADE');
  await pool.query('TRUNCATE TABLE channel_members CASCADE');
  await pool.query('TRUNCATE TABLE channels CASCADE');
  await pool.query('TRUNCATE TABLE whitelist CASCADE');
  await pool.query('TRUNCATE TABLE cohorts CASCADE');
  await pool.query('TRUNCATE TABLE events CASCADE');
}

/**
 * Seed test cohorts
 */
export async function seedTestCohorts(): Promise<void> {
  const pool = getTestPool();

  const cohorts = [
    {
      name: 'admin',
      description: 'Administrators with full access',
      permissions: JSON.stringify({
        read: true,
        write: true,
        delete: true,
        manage_users: true,
        manage_channels: true,
        manage_events: true
      })
    },
    {
      name: 'business',
      description: 'Business community members',
      permissions: JSON.stringify({
        read: true,
        write: true,
        delete_own: true,
        create_channels: false,
        create_events: true
      })
    },
    {
      name: 'moomaa-tribe',
      description: 'Moomaa tribe community members',
      permissions: JSON.stringify({
        read: true,
        write: true,
        delete_own: true,
        create_channels: false,
        create_events: true
      })
    }
  ];

  for (const cohort of cohorts) {
    await pool.query(
      'INSERT INTO cohorts (name, description, permissions) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [cohort.name, cohort.description, cohort.permissions]
    );
  }
}

/**
 * Global setup
 */
export async function globalSetup(): Promise<void> {
  await setupTestDatabase();
  await seedTestCohorts();
}

/**
 * Global teardown
 */
export async function globalTeardown(): Promise<void> {
  await cleanTestDatabase();
  await closeTestPool();
}
