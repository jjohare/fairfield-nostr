import { WhitelistSync } from './whitelist-sync';
import { PushNotifier } from './push-notifier'; // Will be implemented later
import { resolve } from 'path';

// Configuration
const RELAY_URL = process.env.RELAY_URL || 'ws://relay:7777';
const WHITELIST_PATH = process.env.WHITELIST_PATH || resolve(__dirname, '../../relay/whitelist.json');

// Start Whitelist Sync Service
const whitelistSync = new WhitelistSync(RELAY_URL, WHITELIST_PATH);
whitelistSync.start();

console.log('[Controller] Services started');

// Keep process alive
process.on('SIGINT', () => {
  console.log('[Controller] Shutting down...');
  process.exit(0);
});