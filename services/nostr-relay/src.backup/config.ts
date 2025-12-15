/**
 * Configuration loader and validation
 */
import { RelayConfig } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config: RelayConfig = {
  port: getEnvNumber('PORT', 8080),
  host: getEnv('HOST', '0.0.0.0'),

  database: {
    connectionString: getEnv('DATABASE_URL'),
    poolMin: getEnvNumber('DB_POOL_MIN', 2),
    poolMax: getEnvNumber('DB_POOL_MAX', 10),
  },

  relayInfo: {
    name: getEnv('RELAY_NAME', 'Nostr Relay'),
    description: getEnv('RELAY_DESCRIPTION', 'A Nostr relay service'),
    pubkey: getEnv('RELAY_PUBKEY', ''),
    contact: getEnv('RELAY_CONTACT', 'admin@example.com'),
    supported_nips: [1, 2, 4, 9, 11, 12, 15, 16, 20, 33, 40, 42],
    software: 'fairfield-nostr-relay',
    version: '1.0.0',
    icon: process.env.RELAY_ICON,
    limitation: {
      auth_required: getEnvBoolean('AUTH_REQUIRED', true),
      max_message_length: getEnvNumber('MAX_EVENT_SIZE_BYTES', 65536),
      max_subscriptions: getEnvNumber('MAX_SUBSCRIPTIONS_PER_CLIENT', 20),
      max_filters: getEnvNumber('MAX_FILTERS_PER_SUBSCRIPTION', 10),
      max_limit: getEnvNumber('MAX_LIMIT_PER_FILTER', 5000),
      created_at_lower_limit: getEnvNumber('CREATED_AT_LOWER_LIMIT', 1577836800),
      created_at_upper_limit: getEnvNumber('CREATED_AT_UPPER_LIMIT', 32503680000),
    },
  },

  authRequired: getEnvBoolean('AUTH_REQUIRED', true),
  nip05ValidationEnabled: getEnvBoolean('NIP05_VALIDATION_ENABLED', false),
  cohortAccessEnabled: getEnvBoolean('COHORT_ACCESS_ENABLED', true),

  rateLimits: {
    events: {
      rate: getEnvNumber('RATE_LIMIT_EVENTS', 10),
      capacity: getEnvNumber('RATE_LIMIT_EVENTS', 10),
    },
    reqs: {
      rate: getEnvNumber('RATE_LIMIT_REQ', 30),
      capacity: getEnvNumber('RATE_LIMIT_REQ', 30),
    },
  },

  eventLimits: {
    maxSize: getEnvNumber('MAX_EVENT_SIZE_BYTES', 65536),
    maxSubscriptions: getEnvNumber('MAX_SUBSCRIPTIONS_PER_CLIENT', 20),
    maxFilters: getEnvNumber('MAX_FILTERS_PER_SUBSCRIPTION', 10),
    maxLimit: getEnvNumber('MAX_LIMIT_PER_FILTER', 5000),
  },

  timeLimits: {
    createdAtLower: getEnvNumber('CREATED_AT_LOWER_LIMIT', 1577836800),
    createdAtUpper: getEnvNumber('CREATED_AT_UPPER_LIMIT', 32503680000),
  },

  features: {
    search: getEnvBoolean('ENABLE_SEARCH', true),
    deletion: getEnvBoolean('ENABLE_DELETION', true),
    ephemeral: getEnvBoolean('ENABLE_EPHEMERAL', true),
  },

  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
    file: process.env.LOG_FILE,
  },
};

export default config;
