-- Development Seed Data
-- Description: Sample data for development and testing
-- WARNING: DO NOT USE IN PRODUCTION

BEGIN;

-- Add sample users to whitelist
INSERT INTO whitelist (pubkey, cohorts, added_by, notes) VALUES
  -- Admin user
  ('49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', '["admin"]'::jsonb, 'system', 'Default admin'),

  -- Business users
  ('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', '["business"]'::jsonb, '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', 'Test business user 1'),
  ('b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', '["business"]'::jsonb, '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', 'Test business user 2'),

  -- Moomaa tribe users
  ('c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', '["moomaa-tribe"]'::jsonb, '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', 'Test tribe member 1'),
  ('d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', '["moomaa-tribe"]'::jsonb, '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', 'Test tribe member 2'),

  -- Multi-cohort user
  ('e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', '["business","moomaa-tribe"]'::jsonb, '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2', 'Multi-cohort test user')
ON CONFLICT (pubkey) DO NOTHING;

-- Add sample channels
INSERT INTO channels (id, name, description, cohorts, visibility, admin_pubkey) VALUES
  ('general', 'General Discussion', 'Open chat for all members', '["admin","business","moomaa-tribe"]'::jsonb, 'listed', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2'),
  ('business', 'Business Channel', 'Business community discussions', '["admin","business"]'::jsonb, 'listed', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2'),
  ('tribe', 'Moomaa Tribe', 'Tribe member discussions', '["admin","moomaa-tribe"]'::jsonb, 'listed', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2'),
  ('admin-only', 'Admin Channel', 'Administrator-only channel', '["admin"]'::jsonb, 'private', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2')
ON CONFLICT (id) DO NOTHING;

-- Add sample calendar events
INSERT INTO calendar_events (
  id, event_id, pubkey, title, description, start_time, end_time, cohorts, kind
) VALUES
  (
    'event-1',
    'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2',
    '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2',
    'Community Meetup',
    'Monthly community gathering',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days' + INTERVAL '2 hours',
    '["admin","business","moomaa-tribe"]'::jsonb,
    31923
  ),
  (
    'event-2',
    'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3',
    '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2',
    'Business Strategy Session',
    'Quarterly planning meeting',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days' + INTERVAL '3 hours',
    '["admin","business"]'::jsonb,
    31923
  )
ON CONFLICT (id) DO NOTHING;

-- Add sample RSVPs
INSERT INTO calendar_rsvps (id, event_id, pubkey, status) VALUES
  ('rsvp-1', 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'accepted'),
  ('rsvp-2', 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'tentative'),
  ('rsvp-3', 'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'accepted')
ON CONFLICT (id) DO NOTHING;

COMMIT;
