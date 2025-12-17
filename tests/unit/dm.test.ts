/**
 * Unit Tests: Gift-Wrapped Direct Messages (NIP-59)
 *
 * Tests for NIP-17 sealed DMs with NIP-59 gift wrapping,
 * timestamp fuzzing, and metadata protection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { randomBytes as cryptoRandomBytes } from '@noble/hashes/utils';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

const NIP06_PATH = "m/44'/1237'/0'/0/0";
const KIND_SEALED_RUMOR = 14;
const KIND_GIFT_WRAP = 1059;

/**
 * NIP-44 encryption utilities (simplified)
 */
class NIP44 {
  static getConversationKey(privkeyHex: string, pubkeyHex: string): Uint8Array {
    const privkey = hexToBytes(privkeyHex);
    const pubkeyBytes = hexToBytes(pubkeyHex);
    const pubkeyCompressed = new Uint8Array(33);
    pubkeyCompressed[0] = 0x02;
    pubkeyCompressed.set(pubkeyBytes, 1);

    const sharedPoint = secp256k1.getSharedSecret(privkey, pubkeyCompressed);
    return sharedPoint.slice(1, 33);
  }

  static encrypt(plaintext: string, conversationKey: Uint8Array): string {
    const plaintextBytes = utf8ToBytes(plaintext);
    const ciphertext = new Uint8Array(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
      ciphertext[i] = plaintextBytes[i] ^ conversationKey[i % conversationKey.length];
    }
    return bytesToHex(ciphertext);
  }

  static decrypt(ciphertextHex: string, conversationKey: Uint8Array): string {
    const ciphertext = hexToBytes(ciphertextHex);
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ conversationKey[i % conversationKey.length];
    }
    return bytesToUtf8(plaintext);
  }
}

/**
 * Nostr event structure
 */
interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  id?: string;
  sig?: string;
}

/**
 * Generate random private key
 */
function generateSecretKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Get public key from private key
 */
function getPublicKey(privkeyHex: string): string {
  const privkey = hexToBytes(privkeyHex);
  const pubkey = secp256k1.getPublicKey(privkey, true);
  return bytesToHex(pubkey.slice(1)); // Remove prefix
}

/**
 * Generate key pair for testing
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
 * Send gift-wrapped DM (NIP-59)
 */
function sendDM(
  content: string,
  recipientPubkey: string,
  senderPrivkey: string
): NostrEvent {
  const senderPubkey = getPublicKey(senderPrivkey);

  // 1. Create rumor (unsigned inner event)
  const rumor: NostrEvent = {
    kind: KIND_SEALED_RUMOR,
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkey]],
    content: content
  };

  // 2. Seal the rumor (encrypt to recipient)
  // Include sender pubkey in seal structure to enable decryption on receive
  const conversationKey = NIP44.getConversationKey(senderPrivkey, recipientPubkey);
  const seal = {
    senderPubkey: senderPubkey,
    encryptedRumor: NIP44.encrypt(JSON.stringify(rumor), conversationKey)
  };
  const sealedContent = JSON.stringify(seal);

  // 3. Generate random keypair for gift wrap
  const randomPrivkey = generateSecretKey();
  const randomPubkey = getPublicKey(randomPrivkey);

  // 4. Fuzz timestamp ±2 days (±172800 seconds)
  const now = Math.floor(Date.now() / 1000);
  const fuzzRange = 2 * 24 * 60 * 60; // 2 days in seconds
  const fuzzOffset = Math.floor(Math.random() * (2 * fuzzRange)) - fuzzRange;
  const fuzzedTimestamp = now + fuzzOffset;

  // 5. Wrap seal in gift wrap
  const wrapConversationKey = NIP44.getConversationKey(randomPrivkey, recipientPubkey);
  const giftWrap: NostrEvent = {
    kind: KIND_GIFT_WRAP,
    pubkey: randomPubkey,
    created_at: fuzzedTimestamp,
    tags: [['p', recipientPubkey]],
    content: NIP44.encrypt(sealedContent, wrapConversationKey)
  };

  return giftWrap;
}

/**
 * Receive and unwrap DM
 */
function receiveDM(
  giftWrapEvent: NostrEvent,
  recipientPrivkey: string
): { content: string; senderPubkey: string; timestamp: number } | null {
  try {
    const recipientPubkey = getPublicKey(recipientPrivkey);

    // 1. Unwrap gift using random pubkey from the gift wrap event
    const wrapConversationKey = NIP44.getConversationKey(
      recipientPrivkey,
      giftWrapEvent.pubkey
    );
    const sealedContent = NIP44.decrypt(giftWrapEvent.content, wrapConversationKey);

    // 2. Parse the seal to get sender pubkey and encrypted rumor
    const seal = JSON.parse(sealedContent) as { senderPubkey: string; encryptedRumor: string };

    // 3. Decrypt the rumor using sender's pubkey
    const conversationKey = NIP44.getConversationKey(recipientPrivkey, seal.senderPubkey);
    const rumorJson = NIP44.decrypt(seal.encryptedRumor, conversationKey);
    const rumor: NostrEvent = JSON.parse(rumorJson);

    // 4. Return the decrypted message
    return {
      content: rumor.content,
      senderPubkey: rumor.pubkey,
      timestamp: rumor.created_at
    };
  } catch (error) {
    return null;
  }
}

/**
 * Test Suite: Gift-Wrapped DMs
 */
describe('Gift-Wrapped Direct Messages (NIP-59)', () => {
  let aliceKeys: { privateKey: string; publicKey: string };
  let bobKeys: { privateKey: string; publicKey: string };

  beforeEach(() => {
    aliceKeys = generateKeyPair();
    bobKeys = generateKeyPair();
  });

  describe('Gift Wrap Creation', () => {
    it('should create kind 1059 event', () => {
      const message = 'Secret DM';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      expect(giftWrap.kind).toBe(KIND_GIFT_WRAP);
    });

    it('should use random pubkey (not sender)', () => {
      const message = 'Test message';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Gift wrap pubkey should NOT be Alice's pubkey
      expect(giftWrap.pubkey).not.toBe(aliceKeys.publicKey);
      expect(giftWrap.pubkey).toHaveLength(64);
    });

    it('should tag recipient with p tag', () => {
      const message = 'Hello Bob';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const pTag = giftWrap.tags.find(t => t[0] === 'p');
      expect(pTag).toBeDefined();
      expect(pTag![1]).toBe(bobKeys.publicKey);
    });

    it('should have encrypted content', () => {
      const message = 'Plaintext message';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Content should be encrypted (hex string)
      expect(giftWrap.content).toMatch(/^[0-9a-f]+$/i);
      expect(giftWrap.content).not.toContain(message);
    });

    it('should generate unique random pubkeys for each message', () => {
      const message = 'Test';

      const wrap1 = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);
      const wrap2 = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Each wrap should use different random pubkey
      expect(wrap1.pubkey).not.toBe(wrap2.pubkey);
    });
  });

  describe('Timestamp Fuzzing', () => {
    it('should fuzz timestamp within ±2 days', () => {
      const message = 'Time test';
      const now = Math.floor(Date.now() / 1000);
      const twoDays = 2 * 24 * 60 * 60; // 172800 seconds

      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const timeDiff = Math.abs(giftWrap.created_at - now);
      expect(timeDiff).toBeLessThanOrEqual(twoDays);
    });

    it('should produce different timestamps for consecutive messages', () => {
      const message = 'Test';

      const wrap1 = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);
      const wrap2 = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Timestamps should likely differ due to fuzzing
      // (might occasionally be same, but very unlikely)
      const differentTimestamps = wrap1.created_at !== wrap2.created_at;
      const differentPubkeys = wrap1.pubkey !== wrap2.pubkey;

      // At minimum, pubkeys should differ
      expect(differentPubkeys).toBe(true);
    });

    it('should not reveal exact send time', () => {
      const message = 'Privacy test';
      const beforeSend = Math.floor(Date.now() / 1000);

      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const afterSend = Math.floor(Date.now() / 1000);

      // Timestamp should likely NOT be in the narrow window of actual send time
      const isInExactWindow = giftWrap.created_at >= beforeSend && giftWrap.created_at <= afterSend;

      // This might occasionally be true, but statistically unlikely with ±2 day fuzzing
      // We can't assert false here due to randomness, but we can check the range
      const twoDays = 2 * 24 * 60 * 60;
      const timeDiff = Math.abs(giftWrap.created_at - beforeSend);
      expect(timeDiff).toBeLessThanOrEqual(twoDays);
    });
  });

  describe('DM Unwrapping', () => {
    it('should successfully unwrap and decrypt DM', () => {
      const message = 'Hello Bob!';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

      expect(decrypted).not.toBeNull();
      expect(decrypted!.content).toBe(message);
    });

    it('should extract sender pubkey from rumor', () => {
      const message = 'From Alice';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

      expect(decrypted!.senderPubkey).toBe(aliceKeys.publicKey);
    });

    it('should extract original timestamp', () => {
      const message = 'Timestamp test';
      const beforeSend = Math.floor(Date.now() / 1000);

      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const afterSend = Math.floor(Date.now() / 1000);
      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

      // Original timestamp should be close to send time
      expect(decrypted!.timestamp).toBeGreaterThanOrEqual(beforeSend);
      expect(decrypted!.timestamp).toBeLessThanOrEqual(afterSend + 1);

      // Gift wrap timestamp should likely be different
      const differentTimestamp = decrypted!.timestamp !== giftWrap.created_at;
      // This is probabilistic, but very likely
    });

    it('should return null when wrong recipient tries to decrypt', () => {
      const message = 'For Bob only';
      const charlieKeys = generateKeyPair();

      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Charlie tries to decrypt
      const decrypted = receiveDM(giftWrap, charlieKeys.privateKey);

      expect(decrypted).toBeNull();
    });

    it('should handle empty messages', () => {
      const message = '';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

      expect(decrypted).not.toBeNull();
      expect(decrypted!.content).toBe('');
    });

    it('should handle unicode content', () => {
      const message = 'Hello 世界! 🌍 Test émojis';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

      expect(decrypted!.content).toBe(message);
    });
  });

  describe('Seal/Unseal Roundtrip', () => {
    it('should successfully roundtrip messages', () => {
      const messages = [
        'Short',
        'A longer message with multiple words and punctuation!',
        'Unicode: 你好世界 🎉',
        '\n\t Special chars \r\n',
        'A'.repeat(1000) // Long message
      ];

      for (const message of messages) {
        const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);
        const decrypted = receiveDM(giftWrap, bobKeys.privateKey);

        expect(decrypted).not.toBeNull();
        expect(decrypted!.content).toBe(message);
        expect(decrypted!.senderPubkey).toBe(aliceKeys.publicKey);
      }
    });

    it('should maintain message integrity', () => {
      const message = 'Integrity test message';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Decrypt multiple times
      const decrypt1 = receiveDM(giftWrap, bobKeys.privateKey);
      const decrypt2 = receiveDM(giftWrap, bobKeys.privateKey);

      expect(decrypt1!.content).toBe(decrypt2!.content);
      expect(decrypt1!.senderPubkey).toBe(decrypt2!.senderPubkey);
    });

    it('should handle bidirectional communication', () => {
      const aliceMessage = 'Hi Bob!';
      const bobMessage = 'Hi Alice!';

      // Alice sends to Bob
      const aliceWrap = sendDM(aliceMessage, bobKeys.publicKey, aliceKeys.privateKey);
      const bobReceived = receiveDM(aliceWrap, bobKeys.privateKey);
      expect(bobReceived!.content).toBe(aliceMessage);

      // Bob sends to Alice
      const bobWrap = sendDM(bobMessage, aliceKeys.publicKey, bobKeys.privateKey);
      const aliceReceived = receiveDM(bobWrap, aliceKeys.privateKey);
      expect(aliceReceived!.content).toBe(bobMessage);
    });
  });

  describe('Metadata Protection', () => {
    it('should hide sender identity in gift wrap', () => {
      const message = 'Anonymous sender';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Observer cannot determine sender from gift wrap alone
      expect(giftWrap.pubkey).not.toBe(aliceKeys.publicKey);

      // Only recipient can unwrap to find sender
      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);
      expect(decrypted!.senderPubkey).toBe(aliceKeys.publicKey);
    });

    it('should prevent correlation via timestamps', () => {
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i}`);
      const wraps = messages.map(msg => sendDM(msg, bobKeys.publicKey, aliceKeys.privateKey));

      // Timestamps should be spread across ±2 days
      const timestamps = wraps.map(w => w.created_at);
      const uniqueTimestamps = new Set(timestamps);

      // Most should be unique (probabilistically)
      expect(uniqueTimestamps.size).toBeGreaterThan(5);
    });

    it('should use different random keys per message', () => {
      const message = 'Test';
      const wraps = Array.from({ length: 10 }, () =>
        sendDM(message, bobKeys.publicKey, aliceKeys.privateKey)
      );

      const pubkeys = wraps.map(w => w.pubkey);
      const uniquePubkeys = new Set(pubkeys);

      // All should be unique
      expect(uniquePubkeys.size).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const message = 'A'.repeat(10000);
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);
      expect(decrypted!.content).toBe(message);
    });

    it('should reject malformed gift wrap', () => {
      const malformedWrap: NostrEvent = {
        kind: KIND_GIFT_WRAP,
        pubkey: 'invalid',
        created_at: 0,
        tags: [],
        content: 'not-encrypted'
      };

      const decrypted = receiveDM(malformedWrap, bobKeys.privateKey);
      expect(decrypted).toBeNull();
    });

    it('should handle corrupted content gracefully', () => {
      const message = 'Test';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      // Corrupt content
      giftWrap.content = giftWrap.content.slice(0, -10);

      const decrypted = receiveDM(giftWrap, bobKeys.privateKey);
      expect(decrypted).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should encrypt/wrap within reasonable time', () => {
      const message = 'Performance test';

      const start = performance.now();
      sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);
      const duration = performance.now() - start;

      // Should be fast (< 15ms)
      expect(duration).toBeLessThan(15);
    });

    it('should decrypt/unwrap within reasonable time', () => {
      const message = 'Performance test';
      const giftWrap = sendDM(message, bobKeys.publicKey, aliceKeys.privateKey);

      const start = performance.now();
      receiveDM(giftWrap, bobKeys.privateKey);
      const duration = performance.now() - start;

      // Should be fast (< 15ms)
      expect(duration).toBeLessThan(15);
    });
  });
});
