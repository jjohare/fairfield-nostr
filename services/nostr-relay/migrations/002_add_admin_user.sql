-- Migration: 002_add_admin_user
-- Description: Add default admin user to whitelist
-- Author: System
-- Date: 2025-12-15

BEGIN;

-- Add admin user to whitelist
-- This pubkey should be replaced with the actual admin's public key
INSERT INTO whitelist (pubkey, cohorts, added_by, notes) VALUES
  (
    '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2',
    '["admin"]'::jsonb,
    'system',
    'Default admin user - created during initial setup'
  )
ON CONFLICT (pubkey)
DO UPDATE SET
  cohorts = EXCLUDED.cohorts,
  notes = EXCLUDED.notes;

-- Log the action
INSERT INTO audit_log (action, actor_pubkey, target_pubkey, target_type, details)
VALUES (
  'whitelist_add',
  'system',
  '49dfa09158b64f1c42c584a7e3e9adb4c9e8ea9d391ff11c2ac262d1bebbc5a2',
  'user',
  '{"cohorts":["admin"],"source":"migration"}'::jsonb
);

COMMIT;
