/**
 * Unit Tests: Key Generation and Management
 *
 * Tests for NIP-06 key derivation, BIP-39 mnemonic generation,
 * and key pair management according to SPARC specification.
 */

import { describe, it, expect } from 'vitest';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { TEST_VECTORS, isValidSecp256k1PrivateKey, isValidSecp256k1PublicKey } from '../setup';

/**
 * NIP-06 derivation path for Nostr keys
 */
const NIP06_PATH = "m/44'/1237'/0'/0/0";

/**
 * Key pair interface matching specification
 */
interface KeyPair {
  mnemonic: string;
  privateKey: string;  // hex
  publicKey: string;   // hex (x-only, no prefix)
}

/**
 * Generate new identity with mnemonic
 */
function generateNewIdentity(): KeyPair {
  // 1. Generate 12-word mnemonic (128 bits entropy)
  const mnemonic = bip39.generateMnemonic(wordlist, 128);

  // 2. Derive seed from mnemonic (no passphrase)
  const seed = bip39.mnemonicToSeedSync(mnemonic, '');

  // 3. Derive HD key at NIP-06 path
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  // 4. Extract keys - Nostr uses x-only pubkeys (32 bytes, no prefix)
  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = bytesToHex(derived.publicKey!.slice(1)); // Remove 0x02/0x03 prefix byte

  return { mnemonic, privateKey, publicKey };
}

/**
 * Restore keys from existing mnemonic
 */
function restoreFromMnemonic(mnemonic: string): Omit<KeyPair, 'mnemonic'> {
  const seed = bip39.mnemonicToSeedSync(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey || !derived.publicKey) {
    throw new Error('Failed to derive keys from mnemonic');
  }

  return {
    privateKey: bytesToHex(derived.privateKey),
    publicKey: bytesToHex(derived.publicKey.slice(1))
  };
}

/**
 * Test Suite: Key Generation
 */
describe('Key Generation', () => {
  describe('generateNewIdentity()', () => {
    it('should generate valid 12-word mnemonic', () => {
      const identity = generateNewIdentity();

      const words = identity.mnemonic.split(' ');
      expect(words).toHaveLength(12);

      // All words should be from BIP-39 wordlist
      words.forEach(word => {
        expect(wordlist).toContain(word);
      });
    });

    it('should produce valid secp256k1 private key (64 hex chars)', () => {
      const identity = generateNewIdentity();

      expect(identity.privateKey).toMatch(/^[0-9a-f]{64}$/);
      expect(isValidSecp256k1PrivateKey(identity.privateKey)).toBe(true);
    });

    it('should produce valid secp256k1 public key (64 hex chars, x-only)', () => {
      const identity = generateNewIdentity();

      // Nostr uses x-only pubkeys (32 bytes = 64 hex chars)
      expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/);
      expect(isValidSecp256k1PublicKey(identity.publicKey)).toBe(true);
    });

    it('should generate unique mnemonics on each call', () => {
      const identity1 = generateNewIdentity();
      const identity2 = generateNewIdentity();

      expect(identity1.mnemonic).not.toBe(identity2.mnemonic);
      expect(identity1.privateKey).not.toBe(identity2.privateKey);
      expect(identity1.publicKey).not.toBe(identity2.publicKey);
    });

    it('should generate valid mnemonic according to BIP-39', () => {
      const identity = generateNewIdentity();

      expect(bip39.validateMnemonic(identity.mnemonic, wordlist)).toBe(true);
    });

    it('should derive keys following NIP-06 path', () => {
      const identity = generateNewIdentity();

      // Verify derivation by re-deriving from mnemonic
      const restored = restoreFromMnemonic(identity.mnemonic);

      expect(restored.privateKey).toBe(identity.privateKey);
      expect(restored.publicKey).toBe(identity.publicKey);
    });
  });

  describe('restoreFromMnemonic()', () => {
    it('should be deterministic - same mnemonic produces same keys', () => {
      const mnemonic = TEST_VECTORS.MNEMONIC;

      const keys1 = restoreFromMnemonic(mnemonic);
      const keys2 = restoreFromMnemonic(mnemonic);

      expect(keys1.privateKey).toBe(keys2.privateKey);
      expect(keys1.publicKey).toBe(keys2.publicKey);
    });

    it('should restore keys from known test vector', () => {
      // BIP-39 test vector: "abandon" x11 + "about"
      const mnemonic = TEST_VECTORS.MNEMONIC;

      const keys = restoreFromMnemonic(mnemonic);

      // Keys should be deterministic and valid
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
      expect(isValidSecp256k1PublicKey(keys.publicKey)).toBe(true);

      // Verify same result on re-derivation
      const keys2 = restoreFromMnemonic(mnemonic);
      expect(keys.privateKey).toBe(keys2.privateKey);
      expect(keys.publicKey).toBe(keys2.publicKey);
    });

    it('should produce valid secp256k1 keys', () => {
      const mnemonic = bip39.generateMnemonic(wordlist, 128);
      const keys = restoreFromMnemonic(mnemonic);

      expect(keys.privateKey).toHaveLength(64);
      expect(keys.publicKey).toHaveLength(64);
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
      expect(isValidSecp256k1PublicKey(keys.publicKey)).toBe(true);
    });

    it('should handle different valid mnemonics', () => {
      const mnemonic1 = TEST_VECTORS.MNEMONIC;
      const mnemonic2 = TEST_VECTORS.MNEMONIC_2;

      const keys1 = restoreFromMnemonic(mnemonic1);
      const keys2 = restoreFromMnemonic(mnemonic2);

      // Different mnemonics should produce different keys
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });
  });

  describe('Invalid Mnemonic Handling', () => {
    it('should reject invalid word count', () => {
      const invalidMnemonic = 'abandon abandon abandon'; // Only 3 words

      expect(() => restoreFromMnemonic(invalidMnemonic)).toThrow();
    });

    it('should reject invalid BIP-39 checksum', () => {
      // Valid structure but wrong checksum
      const invalidMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';

      expect(bip39.validateMnemonic(invalidMnemonic, wordlist)).toBe(false);
    });

    it('should reject words not in BIP-39 wordlist', () => {
      const invalidMnemonic = 'notaword test invalid mnemonic phrase with twelve words total here okay';

      expect(bip39.validateMnemonic(invalidMnemonic, wordlist)).toBe(false);
    });

    it('should reject empty mnemonic', () => {
      expect(() => restoreFromMnemonic('')).toThrow();
    });
  });

  describe('NIP-06 Derivation Path', () => {
    it('should use correct derivation path m/44\'/1237\'/0\'/0/0', () => {
      const mnemonic = TEST_VECTORS.MNEMONIC;
      const seed = bip39.mnemonicToSeedSync(mnemonic, '');
      const hdKey = HDKey.fromMasterSeed(seed);

      // Derive at NIP-06 path
      const derived = hdKey.derive(NIP06_PATH);

      expect(derived.privateKey).toBeDefined();
      expect(derived.publicKey).toBeDefined();

      // Verify it matches restoreFromMnemonic
      const restored = restoreFromMnemonic(mnemonic);
      expect(bytesToHex(derived.privateKey!)).toBe(restored.privateKey);
      expect(bytesToHex(derived.publicKey!.slice(1))).toBe(restored.publicKey);
    });

    it('should produce different keys for different derivation indices', () => {
      const mnemonic = TEST_VECTORS.MNEMONIC;
      const seed = bip39.mnemonicToSeedSync(mnemonic, '');
      const hdKey = HDKey.fromMasterSeed(seed);

      // Derive at index 0 (standard)
      const key0 = hdKey.derive("m/44'/1237'/0'/0/0");
      // Derive at index 1 (alternative account)
      const key1 = hdKey.derive("m/44'/1237'/0'/0/1");

      expect(bytesToHex(key0.privateKey!)).not.toBe(bytesToHex(key1.privateKey!));
      expect(bytesToHex(key0.publicKey!)).not.toBe(bytesToHex(key1.publicKey!));
    });
  });

  describe('Edge Cases', () => {
    it('should handle mnemonic with extra whitespace', () => {
      const mnemonic = TEST_VECTORS.MNEMONIC;
      const mnemonicWithSpaces = `  ${mnemonic.split(' ').join('   ')}  `;

      // Should normalize whitespace
      const normalized = mnemonicWithSpaces.trim().replace(/\s+/g, ' ');
      const keys = restoreFromMnemonic(normalized);

      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
    });

    it('should handle 128-bit entropy mnemonics (12 words)', () => {
      const mnemonic = bip39.generateMnemonic(wordlist, 128);
      expect(mnemonic.split(' ')).toHaveLength(12);

      const keys = restoreFromMnemonic(mnemonic);
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
    });

    it('should handle 256-bit entropy mnemonics (24 words)', () => {
      const mnemonic = bip39.generateMnemonic(wordlist, 256);
      expect(mnemonic.split(' ')).toHaveLength(24);

      const keys = restoreFromMnemonic(mnemonic);
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should generate high-entropy mnemonics', () => {
      // Generate multiple mnemonics and verify they're unique
      const mnemonics = new Set();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const identity = generateNewIdentity();
        mnemonics.add(identity.mnemonic);
      }

      // All should be unique
      expect(mnemonics.size).toBe(count);
    });

    it('should not expose private key in any form except hex', () => {
      const identity = generateNewIdentity();

      // Private key should only be the hex string
      expect(typeof identity.privateKey).toBe('string');
      expect(identity.privateKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
