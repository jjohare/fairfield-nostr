/**
 * Application Configuration
 * Environment-based configuration for Minimoomaa Noir
 */

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, fallback?: string): string {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    return import.meta.env[key] as string;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Environment variable ${key} is required but not set`);
}

/**
 * Nostr relay URL
 * Default: ws://localhost:8080
 */
export const RELAY_URL = getEnv('VITE_RELAY_URL', 'ws://localhost:8080');

/**
 * Admin public key (hex format)
 * Required for admin operations
 */
export const ADMIN_PUBKEY = getEnv('VITE_ADMIN_PUBKEY', '');

/**
 * Application name for Nostr events
 */
export const APP_NAME = 'Minimoomaa Noir';

/**
 * Application version
 */
export const APP_VERSION = '0.1.0';

/**
 * NDK configuration
 */
export const NDK_CONFIG = {
  /**
   * Enable debug logging
   */
  enableDebug: getEnv('VITE_NDK_DEBUG', 'false') === 'true',

  /**
   * Cache adapter configuration
   */
  cache: {
    enabled: true,
    name: 'minimoomaa-noir-cache',
    version: 1
  },

  /**
   * Relay pool configuration
   */
  pool: {
    maxRelays: 5,
    connectTimeout: 5000,
    reconnectDelay: 1000
  }
} as const;

/**
 * Connection timeouts (milliseconds)
 */
export const TIMEOUTS = {
  connect: 10000,
  auth: 5000,
  publish: 5000,
  subscribe: 30000
} as const;

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!RELAY_URL) {
    errors.push('RELAY_URL is required');
  }

  if (!RELAY_URL.startsWith('ws://') && !RELAY_URL.startsWith('wss://')) {
    errors.push('RELAY_URL must start with ws:// or wss://');
  }

  if (ADMIN_PUBKEY && !/^[0-9a-f]{64}$/i.test(ADMIN_PUBKEY)) {
    errors.push('ADMIN_PUBKEY must be a 64-character hex string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
