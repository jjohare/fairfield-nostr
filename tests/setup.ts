/**
 * Vitest Test Setup
 *
 * Configuration and utilities for Fairfield Nostr test suite.
 * This file runs before all tests to set up the testing environment.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

/**
 * Global test setup - runs once before all tests
 */
beforeAll(() => {
  // Set deterministic random seed for reproducible tests
  // Note: This doesn't affect crypto operations which use secure randomness
  process.env.NODE_ENV = 'test';
});

/**
 * Global test teardown - runs once after all tests
 */
afterAll(() => {
  // Cleanup any resources if needed
});

/**
 * Per-test setup - runs before each test
 */
beforeEach(() => {
  // Clear any test state
});

/**
 * Per-test teardown - runs after each test
 */
afterEach(() => {
  // Cleanup after each test
});

/**
 * Test utilities
 */

/**
 * Generate a valid test mnemonic phrase
 */
export function getTestMnemonic(): string {
  // Standard BIP-39 test vector: "abandon" repeated 11 times + "about"
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
}

/**
 * Known test vectors for deterministic testing
 */
export const TEST_VECTORS = {
  // BIP-39 standard test vector
  MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Expected private key for the above mnemonic at NIP-06 path m/44'/1237'/0'/0/0
  // Note: This will be derived during tests to verify correctness

  // Alternative test mnemonic for second user
  MNEMONIC_2: 'legal winner thank year wave sausage worth useful legal winner thank yellow'
} as const;

/**
 * Hex string utilities
 */
export function isValidHex(str: string): boolean {
  return /^[0-9a-f]+$/i.test(str);
}

export function isValidSecp256k1PrivateKey(hex: string): boolean {
  return isValidHex(hex) && hex.length === 64;
}

export function isValidSecp256k1PublicKey(hex: string): boolean {
  return isValidHex(hex) && hex.length === 64;
}

/**
 * Timing utilities for performance tests
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Random data generation for tests
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  // Use crypto.getRandomValues for secure randomness in tests
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node.js
    const nodeCrypto = require('crypto');
    const buffer = nodeCrypto.randomBytes(length);
    bytes.set(buffer);
  }
  return bytes;
}

/**
 * Assertion helpers
 */
export function assertNever(_: never): never {
  throw new Error('Unexpected value');
}
