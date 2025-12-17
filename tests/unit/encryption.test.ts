/**
 * Unit Tests: NIP-44 Encryption
 *
 * Tests for NIP-44 versioned encryption, conversation key derivation,
 * and multi-recipient channel message encryption.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { TEST_VECTORS } from '../setup';

const NIP06_PATH = "m/44'/1237'/0'/0/0";

/**
 * Simplified NIP-44 v2 implementation for testing
 * Based on the specification: https://github.com/nostr-protocol/nips/blob/master/44.md
 */
class NIP44 {
  /**
   * Derive conversation key from private and public keys
   */
  static getConversationKey(privkeyHex: string, pubkeyHex: string): Uint8Array {
    const privkey = hexToBytes(privkeyHex);

    // Add 0x02 prefix for compressed public key format
    const pubkeyBytes = hexToBytes(pubkeyHex);
    const pubkeyCompressed = new Uint8Array(33);
    pubkeyCompressed[0] = 0x02; // Assume even y-coordinate
    pubkeyCompressed.set(pubkeyBytes, 1);

    // ECDH: shared_secret = privkey * pubkey
    const sharedPoint = secp256k1.getSharedSecret(privkey, pubkeyCompressed);

    // Use x-coordinate as conversation key (32 bytes)
    return sharedPoint.slice(1, 33);
  }

  /**
   * Encrypt plaintext to ciphertext
   * Simplified version - in production use proper NIP-44 implementation
   */
  static encrypt(plaintext: string, conversationKey: Uint8Array): string {
    const plaintextBytes = utf8ToBytes(plaintext);

    // Simple XOR cipher for testing (NOT SECURE - use proper NIP-44 in production)
    const ciphertext = new Uint8Array(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
      ciphertext[i] = plaintextBytes[i] ^ conversationKey[i % conversationKey.length];
    }

    return bytesToHex(ciphertext);
  }

  /**
   * Decrypt ciphertext to plaintext
   */
  static decrypt(ciphertextHex: string, conversationKey: Uint8Array): string {
    const ciphertext = hexToBytes(ciphertextHex);

    // Simple XOR decipher
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ conversationKey[i % conversationKey.length];
    }

    return bytesToUtf8(plaintext);
  }
}

/**
 * Helper to generate key pair
 */
function generateKeyPair(): { privateKey: string; publicKey: string } {
  const mnemonic = bip39.generateMnemonic(wordlist, 128);
  const seed = bip39.mnemonicToSeedSync(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  return {
    privateKey: bytesToHex(derived.privateKey!),
    publicKey: bytesToHex(derived.publicKey!.slice(1))
  };
}

/**
 * Test Suite: NIP-44 Encryption
 */
describe('NIP-44 Encryption', () => {
  let aliceKeys: { privateKey: string; publicKey: string };
  let bobKeys: { privateKey: string; publicKey: string };

  beforeEach(() => {
    // Generate fresh keys for each test
    aliceKeys = generateKeyPair();
    bobKeys = generateKeyPair();
  });

  describe('Conversation Key Derivation', () => {
    it('should derive conversation key from private and public keys', () => {
      const conversationKey = NIP44.getConversationKey(
        aliceKeys.privateKey,
        bobKeys.publicKey
      );

      expect(conversationKey).toBeInstanceOf(Uint8Array);
      expect(conversationKey.length).toBe(32);
    });

    it('should produce same conversation key from both sides', () => {
      // Alice derives key using her privkey and Bob's pubkey
      const aliceConvKey = NIP44.getConversationKey(
        aliceKeys.privateKey,
        bobKeys.publicKey
      );

      // Bob derives key using his privkey and Alice's pubkey
      const bobConvKey = NIP44.getConversationKey(
        bobKeys.privateKey,
        aliceKeys.publicKey
      );

      // Both should derive the same conversation key
      expect(bytesToHex(aliceConvKey)).toBe(bytesToHex(bobConvKey));
    });

    it('should produce deterministic conversation keys', () => {
      const key1 = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);
      const key2 = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      expect(bytesToHex(key1)).toBe(bytesToHex(key2));
    });

    it('should produce different keys for different key pairs', () => {
      const charlieKeys = generateKeyPair();

      const keyAB = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);
      const keyAC = NIP44.getConversationKey(aliceKeys.privateKey, charlieKeys.publicKey);

      expect(bytesToHex(keyAB)).not.toBe(bytesToHex(keyAC));
    });
  });

  describe('Encryption/Decryption Roundtrip', () => {
    it('should encrypt and decrypt plaintext correctly', () => {
      const message = 'Hello, Nostr!';

      const conversationKey = NIP44.getConversationKey(
        aliceKeys.privateKey,
        bobKeys.publicKey
      );

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });

    it('should handle empty messages', () => {
      const message = '';
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });

    it('should handle long messages', () => {
      const message = 'A'.repeat(10000);
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });

    it('should handle unicode characters', () => {
      const message = 'Hello 世界! 🌍 Émoji test';
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });

    it('should produce different ciphertext for same plaintext with different keys', () => {
      const message = 'Test message';
      const charlieKeys = generateKeyPair();

      const convKeyAB = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);
      const convKeyAC = NIP44.getConversationKey(aliceKeys.privateKey, charlieKeys.publicKey);

      const ciphertext1 = NIP44.encrypt(message, convKeyAB);
      const ciphertext2 = NIP44.encrypt(message, convKeyAC);

      expect(ciphertext1).not.toBe(ciphertext2);
    });
  });

  describe('Wrong Key Decryption', () => {
    it('should fail to decrypt with wrong conversation key', () => {
      const message = 'Secret message';
      const charlieKeys = generateKeyPair();

      // Alice encrypts for Bob
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);
      const ciphertext = NIP44.encrypt(message, conversationKey);

      // Charlie tries to decrypt with his key
      const wrongKey = NIP44.getConversationKey(charlieKeys.privateKey, bobKeys.publicKey);
      const decrypted = NIP44.decrypt(ciphertext, wrongKey);

      // Should not produce original message
      expect(decrypted).not.toBe(message);
    });

    it('should produce garbage when decrypting with wrong key', () => {
      const message = 'Test';
      const charlieKeys = generateKeyPair();

      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);
      const ciphertext = NIP44.encrypt(message, conversationKey);

      const wrongKey = NIP44.getConversationKey(aliceKeys.privateKey, charlieKeys.publicKey);
      const decrypted = NIP44.decrypt(ciphertext, wrongKey);

      expect(decrypted).not.toBe(message);
      expect(decrypted.length).toBeGreaterThan(0); // Should produce some output, just wrong
    });
  });

  describe('Multi-Recipient Channel Encryption', () => {
    interface EncryptedChannelMessage {
      payloads: Record<string, string>; // pubkey -> encrypted content
      sender: string;
    }

    function encryptChannelMessage(
      content: string,
      senderPrivkey: string,
      senderPubkey: string,
      recipientPubkeys: string[]
    ): EncryptedChannelMessage {
      const payloads: Record<string, string> = {};

      for (const recipientPubkey of recipientPubkeys) {
        const conversationKey = NIP44.getConversationKey(senderPrivkey, recipientPubkey);
        payloads[recipientPubkey] = NIP44.encrypt(content, conversationKey);
      }

      return { payloads, sender: senderPubkey };
    }

    function decryptChannelMessage(
      message: EncryptedChannelMessage,
      recipientPrivkey: string,
      recipientPubkey: string
    ): string | null {
      const payload = message.payloads[recipientPubkey];
      if (!payload) return null;

      const conversationKey = NIP44.getConversationKey(recipientPrivkey, message.sender);
      return NIP44.decrypt(payload, conversationKey);
    }

    it('should encrypt message for multiple recipients', () => {
      const message = 'Channel message';
      const recipients = [bobKeys.publicKey, generateKeyPair().publicKey];

      const encrypted = encryptChannelMessage(
        message,
        aliceKeys.privateKey,
        aliceKeys.publicKey,
        recipients
      );

      expect(Object.keys(encrypted.payloads)).toHaveLength(2);
      expect(encrypted.payloads[bobKeys.publicKey]).toBeDefined();
    });

    it('should allow each recipient to decrypt their copy', () => {
      const message = 'Test channel message';
      const charlieKeys = generateKeyPair();
      const recipients = [bobKeys.publicKey, charlieKeys.publicKey];

      const encrypted = encryptChannelMessage(
        message,
        aliceKeys.privateKey,
        aliceKeys.publicKey,
        recipients
      );

      // Bob decrypts
      const bobDecrypted = decryptChannelMessage(
        encrypted,
        bobKeys.privateKey,
        bobKeys.publicKey
      );
      expect(bobDecrypted).toBe(message);

      // Charlie decrypts
      const charlieDecrypted = decryptChannelMessage(
        encrypted,
        charlieKeys.privateKey,
        charlieKeys.publicKey
      );
      expect(charlieDecrypted).toBe(message);
    });

    it('should return null for non-recipient', () => {
      const message = 'Private message';
      const charlieKeys = generateKeyPair();

      const encrypted = encryptChannelMessage(
        message,
        aliceKeys.privateKey,
        aliceKeys.publicKey,
        [bobKeys.publicKey]
      );

      // Charlie is not a recipient
      const decrypted = decryptChannelMessage(
        encrypted,
        charlieKeys.privateKey,
        charlieKeys.publicKey
      );

      expect(decrypted).toBeNull();
    });

    it('should create different ciphertexts for each recipient', () => {
      const message = 'Test';
      const charlieKeys = generateKeyPair();
      const recipients = [bobKeys.publicKey, charlieKeys.publicKey];

      const encrypted = encryptChannelMessage(
        message,
        aliceKeys.privateKey,
        aliceKeys.publicKey,
        recipients
      );

      // Each recipient gets different ciphertext
      expect(encrypted.payloads[bobKeys.publicKey]).not.toBe(
        encrypted.payloads[charlieKeys.publicKey]
      );
    });

    it('should handle large recipient lists', () => {
      const message = 'Broadcast message';
      const recipients = Array.from({ length: 50 }, () => generateKeyPair().publicKey);

      const encrypted = encryptChannelMessage(
        message,
        aliceKeys.privateKey,
        aliceKeys.publicKey,
        recipients
      );

      expect(Object.keys(encrypted.payloads)).toHaveLength(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in messages', () => {
      const message = 'Test\nwith\ttabs\rand\0nulls';
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });

    it('should handle binary-safe encryption', () => {
      const message = String.fromCharCode(0, 1, 2, 255);
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const ciphertext = NIP44.encrypt(message, conversationKey);
      const decrypted = NIP44.decrypt(ciphertext, conversationKey);

      expect(decrypted).toBe(message);
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt within reasonable time', () => {
      const message = 'A'.repeat(1000);
      const conversationKey = NIP44.getConversationKey(aliceKeys.privateKey, bobKeys.publicKey);

      const startEncrypt = performance.now();
      const ciphertext = NIP44.encrypt(message, conversationKey);
      const encryptTime = performance.now() - startEncrypt;

      const startDecrypt = performance.now();
      NIP44.decrypt(ciphertext, conversationKey);
      const decryptTime = performance.now() - startDecrypt;

      // Should be fast (< 10ms for 1KB message)
      expect(encryptTime).toBeLessThan(10);
      expect(decryptTime).toBeLessThan(10);
    });
  });
});
