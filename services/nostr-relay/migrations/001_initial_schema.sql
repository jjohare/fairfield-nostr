-- Migration: 001_initial_schema
-- Description: Create initial database schema for Nostr relay
-- Author: System
-- Date: 2025-12-15

BEGIN;

-- Execute the main schema file
\i ../schema.sql

-- Initialize default cohorts
INSERT INTO cohorts (name, description, permissions) VALUES
  ('admin', 'Administrators with full access',
   '{"read":true,"write":true,"delete":true,"manage_users":true,"manage_channels":true,"manage_events":true}'::jsonb),
  ('business', 'Business community members',
   '{"read":true,"write":true,"delete_own":true,"create_channels":false,"create_events":true}'::jsonb),
  ('moomaa-tribe', 'Moomaa tribe community members',
   '{"read":true,"write":true,"delete_own":true,"create_channels":false,"create_events":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Initialize default admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('relay_name', 'Minimoonoir Private Relay'),
  ('relay_description', 'A private community relay for Minimoonoir'),
  ('admin_pubkey', '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2'),
  ('auth_required', 'true'),
  ('external_sync_enabled', 'false'),
  ('max_event_size', '65536'),
  ('max_subscriptions_per_connection', '20'),
  ('rate_limit_messages_per_minute', '60'),
  ('rate_limit_events_per_minute', '30'),
  ('rate_limit_subscriptions_per_minute', '10')
ON CONFLICT (key) DO NOTHING;

COMMIT;
