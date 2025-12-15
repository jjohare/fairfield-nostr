/**
 * Database test fixtures
 */
import { Pool } from 'pg';
import { TEST_ADMIN, TEST_USER_1, TEST_USER_2, TEST_USER_3 } from './test-keys.js';

/**
 * Seed test whitelist entries
 */
export async function seedWhitelist(pool: Pool): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const entries = [
    {
      pubkey: TEST_ADMIN.publicKey,
      cohorts: JSON.stringify(['admin']),
      added_at: now,
      added_by: TEST_ADMIN.publicKey,
      expires_at: null,
      notes: 'Test admin user',
    },
    {
      pubkey: TEST_USER_1.publicKey,
      cohorts: JSON.stringify(['business']),
      added_at: now,
      added_by: TEST_ADMIN.publicKey,
      expires_at: null,
      notes: 'Test business user',
    },
    {
      pubkey: TEST_USER_2.publicKey,
      cohorts: JSON.stringify(['moomaa-tribe']),
      added_at: now,
      added_by: TEST_ADMIN.publicKey,
      expires_at: null,
      notes: 'Test tribe member',
    },
    {
      pubkey: TEST_USER_3.publicKey,
      cohorts: JSON.stringify(['business', 'moomaa-tribe']),
      added_at: now,
      added_by: TEST_ADMIN.publicKey,
      expires_at: now + 86400, // Expires in 24 hours
      notes: 'Test user with expiry',
    },
  ];

  for (const entry of entries) {
    await pool.query(
      `INSERT INTO whitelist (pubkey, cohorts, added_at, added_by, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (pubkey) DO UPDATE SET
         cohorts = EXCLUDED.cohorts,
         expires_at = EXCLUDED.expires_at,
         notes = EXCLUDED.notes`,
      [entry.pubkey, entry.cohorts, entry.added_at, entry.added_by, entry.expires_at, entry.notes]
    );
  }
}

/**
 * Seed test channels
 */
export async function seedChannels(pool: Pool): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const channels = [
    {
      id: 'channel-admin',
      name: 'Admin Channel',
      description: 'Admin-only channel',
      cohorts: JSON.stringify(['admin']),
      visibility: 'private',
      admin_pubkey: TEST_ADMIN.publicKey,
      event_id: null,
    },
    {
      id: 'channel-business',
      name: 'Business Channel',
      description: 'Business cohort channel',
      cohorts: JSON.stringify(['business']),
      visibility: 'listed',
      admin_pubkey: TEST_ADMIN.publicKey,
      event_id: null,
    },
    {
      id: 'channel-tribe',
      name: 'Tribe Channel',
      description: 'Tribe cohort channel',
      cohorts: JSON.stringify(['moomaa-tribe']),
      visibility: 'listed',
      admin_pubkey: TEST_ADMIN.publicKey,
      event_id: null,
    },
    {
      id: 'channel-public',
      name: 'Public Channel',
      description: 'Open to all cohorts',
      cohorts: JSON.stringify(['admin', 'business', 'moomaa-tribe']),
      visibility: 'listed',
      admin_pubkey: TEST_ADMIN.publicKey,
      event_id: null,
    },
  ];

  for (const channel of channels) {
    await pool.query(
      `INSERT INTO channels (id, name, description, cohorts, visibility, admin_pubkey, event_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         cohorts = EXCLUDED.cohorts`,
      [channel.id, channel.name, channel.description, channel.cohorts,
       channel.visibility, channel.admin_pubkey, channel.event_id, now, now]
    );
  }
}

/**
 * Seed calendar events
 */
export async function seedCalendarEvents(pool: Pool): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const futureTime = now + 86400; // 24 hours from now

  const events = [
    {
      id: 'cal-1',
      event_id: 'nostr-event-cal-1',
      pubkey: TEST_ADMIN.publicKey,
      title: 'Admin Meeting',
      description: 'Monthly admin meeting',
      start_time: futureTime,
      end_time: futureTime + 3600,
      location: 'Virtual',
      geohash: null,
      cohorts: JSON.stringify(['admin']),
      kind: 31922,
      d_tag: 'admin-meeting-001',
    },
    {
      id: 'cal-2',
      event_id: 'nostr-event-cal-2',
      pubkey: TEST_USER_1.publicKey,
      title: 'Business Workshop',
      description: 'Quarterly business workshop',
      start_time: futureTime + 7200,
      end_time: futureTime + 10800,
      location: 'Conference Room A',
      geohash: 'u4pruydqqvj',
      cohorts: JSON.stringify(['business']),
      kind: 31923,
      d_tag: 'biz-workshop-q1',
    },
  ];

  for (const event of events) {
    await pool.query(
      `INSERT INTO calendar_events (id, event_id, pubkey, title, description, start_time, end_time, location, geohash, cohorts, kind, d_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, event.event_id, event.pubkey, event.title, event.description,
       event.start_time, event.end_time, event.location, event.geohash,
       event.cohorts, event.kind, event.d_tag]
    );
  }
}

/**
 * Seed all fixtures
 */
export async function seedAllFixtures(pool: Pool): Promise<void> {
  await seedWhitelist(pool);
  await seedChannels(pool);
  await seedCalendarEvents(pool);
}
