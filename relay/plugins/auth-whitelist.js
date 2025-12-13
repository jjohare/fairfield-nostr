#!/usr/bin/env node
/**
 * Strfry Write Policy Plugin - Auth Whitelist
 *
 * This plugin implements NIP-42 authentication requirements.
 * It checks if the event author is on the whitelist or has valid NIP-42 auth.
 *
 * Usage in strfry.conf:
 *   writePolicy {
 *       plugin = "/app/plugins/auth-whitelist.js"
 *   }
 *
 * Environment variables:
 *   WHITELIST_FILE - Path to whitelist.json (default: /app/whitelist.json)
 *   REQUIRE_AUTH   - Require NIP-42 auth for all writes (default: true)
 */

const fs = require('fs');
const readline = require('readline');

// Configuration
const WHITELIST_FILE = process.env.WHITELIST_FILE || '/app/whitelist.json';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== 'false';

// Load whitelist
let whitelist = { admins: [], users: [], banned: [] };
try {
  if (fs.existsSync(WHITELIST_FILE)) {
    const data = fs.readFileSync(WHITELIST_FILE, 'utf8');
    whitelist = JSON.parse(data);
  }
} catch (err) {
  console.error(`[auth-whitelist] Error loading whitelist: ${err.message}`);
}

/**
 * Get all allowed pubkeys from whitelist
 */
function getAllowedPubkeys() {
  const pubkeys = new Set();

  // Add admin pubkeys
  if (whitelist.admins) {
    whitelist.admins.forEach(admin => {
      if (admin.pubkey && admin.pubkey !== 'ADMIN_PUBKEY_HEX_HERE') {
        pubkeys.add(admin.pubkey);
      }
    });
  }

  // Add approved user pubkeys
  if (whitelist.users) {
    whitelist.users.forEach(user => {
      if (user.pubkey && user.status === 'approved' && user.pubkey !== 'USER_PUBKEY_HEX_HERE') {
        pubkeys.add(user.pubkey);
      }
    });
  }

  return pubkeys;
}

/**
 * Check if a pubkey is banned
 */
function isBanned(pubkey) {
  if (!whitelist.banned) return false;
  return whitelist.banned.some(b => b.pubkey === pubkey);
}

/**
 * Check if a pubkey is whitelisted
 */
function isWhitelisted(pubkey) {
  if (isBanned(pubkey)) return false;
  return getAllowedPubkeys().has(pubkey);
}

/**
 * Check if event kind is always allowed (e.g., join requests)
 */
function isAlwaysAllowedKind(kind) {
  // Allow join requests (kind 9021) from anyone
  // Allow NIP-42 auth events
  const alwaysAllowed = [9021, 22242];
  return alwaysAllowed.includes(kind);
}

/**
 * Process a write request
 */
function processEvent(request) {
  const { event, sourceType, sourceInfo } = request;

  // Always allow certain event kinds
  if (isAlwaysAllowedKind(event.kind)) {
    return { id: event.id, action: 'accept', msg: '' };
  }

  // Check if pubkey is whitelisted
  if (isWhitelisted(event.pubkey)) {
    return { id: event.id, action: 'accept', msg: '' };
  }

  // Check NIP-42 authentication status
  if (REQUIRE_AUTH) {
    // sourceInfo contains auth info when available
    if (sourceInfo && sourceInfo.authedPubkey === event.pubkey) {
      return { id: event.id, action: 'accept', msg: '' };
    }

    // Reject if not authenticated
    return {
      id: event.id,
      action: 'reject',
      msg: 'auth-required: Authentication required to publish events'
    };
  }

  // If auth not required and not whitelisted, still allow
  return { id: event.id, action: 'accept', msg: '' };
}

// Main loop - read JSON requests from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const result = processEvent(request);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(`[auth-whitelist] Error processing request: ${err.message}`);
    // Reject on error to be safe
    console.log(JSON.stringify({
      id: '',
      action: 'reject',
      msg: 'internal-error: Plugin processing error'
    }));
  }
});

rl.on('close', () => {
  process.exit(0);
});
