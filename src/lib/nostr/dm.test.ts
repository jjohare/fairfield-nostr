/**
 * Tests for NIP-17/NIP-59 Gift-Wrapped DMs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, type Event } from 'nostr-tools';
import { sendDM, receiveDM, createDMFilter, type Relay } from './dm';
import { resetRateLimit } from '$lib/utils/rateLimit';

describe('Gift-Wrapped DMs (NIP-17/NIP-59)', () => {
  let alicePrivkey: Uint8Array;
  let alicePubkey: string;
  let bobPrivkey: Uint8Array;
  let bobPubkey: string;
  let mockRelay: Relay;
  let publishedEvent: Event | null;

  beforeEach(() => {
    // Reset rate limiter to prevent test interference
    resetRateLimit('dm');

    // Generate test keypairs
    alicePrivkey = generateSecretKey();
    alicePubkey = getPublicKey(alicePrivkey);
    bobPrivkey = generateSecretKey();
    bobPubkey = getPublicKey(bobPrivkey);

    // Mock relay
    publishedEvent = null;
    mockRelay = {
      publish: async (event: Event) => {
        publishedEvent = event;
      },
    };
  });

  describe('sendDM', () => {
    it('should create a kind 1059 gift wrap event', async () => {
      await sendDM('Hello Bob!', bobPubkey, alicePrivkey, mockRelay);

      expect(publishedEvent).not.toBeNull();
      expect(publishedEvent?.kind).toBe(1059);
    });

    it('should use a random pubkey (not sender)', async () => {
      await sendDM('Secret message', bobPubkey, alicePrivkey, mockRelay);

      expect(publishedEvent?.pubkey).not.toBe(alicePubkey);
      expect(publishedEvent?.pubkey).toHaveLength(64); // Valid hex pubkey
    });

    it('should tag recipient with p tag', async () => {
      await sendDM('Tagged message', bobPubkey, alicePrivkey, mockRelay);

      const pTags = publishedEvent?.tags.filter((t) => t[0] === 'p');
      expect(pTags).toHaveLength(1);
      expect(pTags?.[0][1]).toBe(bobPubkey);
    });

    it('should have fuzzed timestamp (different from current)', async () => {
      const beforeTimestamp = Math.floor(Date.now() / 1000);

      await sendDM('Fuzzed time', bobPubkey, alicePrivkey, mockRelay);

      const eventTimestamp = publishedEvent!.created_at;
      const timeDiff = Math.abs(eventTimestamp - beforeTimestamp);

      // Should be within ±2 days (172800 seconds)
      expect(timeDiff).toBeLessThanOrEqual(2 * 24 * 60 * 60);
      // Should be fuzzed (not exact current time)
      expect(timeDiff).toBeGreaterThan(0);
    });

    it('should encrypt content (not readable as plaintext)', async () => {
      const secretMessage = 'This is a secret message!';
      await sendDM(secretMessage, bobPubkey, alicePrivkey, mockRelay);

      expect(publishedEvent?.content).not.toContain(secretMessage);
      expect(publishedEvent?.content).not.toContain(alicePubkey);
    });
  });

  describe('receiveDM', () => {
    it('should decrypt message sent by Alice to Bob', async () => {
      const message = 'Hello Bob, this is Alice!';

      await sendDM(message, bobPubkey, alicePrivkey, mockRelay);
      const result = receiveDM(publishedEvent!, bobPrivkey);

      expect(result).not.toBeNull();
      expect(result?.content).toBe(message);
      expect(result?.senderPubkey).toBe(alicePubkey);
    });

    it('should return null if wrong recipient privkey', async () => {
      await sendDM('Only for Bob', bobPubkey, alicePrivkey, mockRelay);

      const charliePrivkey = generateSecretKey();
      const result = receiveDM(publishedEvent!, charliePrivkey);

      expect(result).toBeNull();
    });

    it('should return null for non-gift-wrap event', () => {
      const normalEvent: Event = {
        id: 'abc123',
        kind: 1, // Regular note, not gift wrap
        pubkey: alicePubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Not encrypted',
        sig: '0'.repeat(128),
      };

      const result = receiveDM(normalEvent, bobPrivkey);
      expect(result).toBeNull();
    });

    it('should preserve real timestamp in decrypted rumor', async () => {
      const beforeTimestamp = Math.floor(Date.now() / 1000);

      await sendDM('Timestamp test', bobPubkey, alicePrivkey, mockRelay);
      const result = receiveDM(publishedEvent!, bobPrivkey);

      expect(result).not.toBeNull();
      // Real timestamp should be close to current time (within 2 seconds)
      expect(Math.abs(result!.timestamp - beforeTimestamp)).toBeLessThan(2);
      // Gift wrap timestamp is fuzzed, but rumor timestamp is real
      expect(result!.timestamp).not.toBe(publishedEvent!.created_at);
    });

    it('should handle special characters and emojis', async () => {
      const message = 'Special chars: 日本語 🚀 <script>alert("xss")</script>';

      await sendDM(message, bobPubkey, alicePrivkey, mockRelay);
      const result = receiveDM(publishedEvent!, bobPrivkey);

      expect(result?.content).toBe(message);
    });

    it('should handle long messages', async () => {
      const longMessage = 'x'.repeat(10000);

      await sendDM(longMessage, bobPubkey, alicePrivkey, mockRelay);
      const result = receiveDM(publishedEvent!, bobPrivkey);

      expect(result?.content).toBe(longMessage);
    });
  });

  describe('createDMFilter', () => {
    it('should create filter for kind 1059 with recipient pubkey', () => {
      const filter = createDMFilter(bobPubkey);

      expect(filter.kinds).toEqual([1059]);
      expect(filter['#p']).toEqual([bobPubkey]);
    });
  });

  describe('end-to-end encryption flow', () => {
    it('should support bidirectional communication', async () => {
      // Alice sends to Bob
      await sendDM('Hi Bob!', bobPubkey, alicePrivkey, mockRelay);
      const event1 = publishedEvent!;

      // Bob sends to Alice
      await sendDM('Hi Alice!', alicePubkey, bobPrivkey, mockRelay);
      const event2 = publishedEvent!;

      // Bob receives Alice's message
      const bobReceives = receiveDM(event1, bobPrivkey);
      expect(bobReceives?.content).toBe('Hi Bob!');
      expect(bobReceives?.senderPubkey).toBe(alicePubkey);

      // Alice receives Bob's message
      const aliceReceives = receiveDM(event2, alicePrivkey);
      expect(aliceReceives?.content).toBe('Hi Alice!');
      expect(aliceReceives?.senderPubkey).toBe(bobPubkey);
    });

    it('should ensure relay cannot determine sender', async () => {
      const messages = [];

      // Alice sends multiple messages
      for (let i = 0; i < 5; i++) {
        await sendDM(`Message ${i}`, bobPubkey, alicePrivkey, mockRelay);
        messages.push({ ...publishedEvent! });
      }

      // All messages should have different random pubkeys
      const pubkeys = messages.map((m) => m.pubkey);
      const uniquePubkeys = new Set(pubkeys);

      expect(uniquePubkeys.size).toBe(5); // All different
      expect(pubkeys.every((pk) => pk !== alicePubkey)).toBe(true); // None are Alice
    });

    it('should ensure relay cannot correlate messages by timestamp', async () => {
      const messages = [];
      const sendTime = Date.now();

      // Send multiple messages quickly
      for (let i = 0; i < 3; i++) {
        await sendDM(`Msg ${i}`, bobPubkey, alicePrivkey, mockRelay);
        messages.push({ ...publishedEvent! });
      }

      const timestamps = messages.map((m) => m.created_at);

      // All timestamps should be fuzzed differently
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(3);

      // None should match the actual send time
      const actualTimestamp = Math.floor(sendTime / 1000);
      expect(timestamps.every((t) => Math.abs(t - actualTimestamp) > 0)).toBe(true);
    });
  });

  describe('privacy guarantees', () => {
    it('should not leak sender identity in gift wrap', async () => {
      await sendDM('Secret', bobPubkey, alicePrivkey, mockRelay);

      const giftWrap = publishedEvent!;

      // Gift wrap should not contain Alice's pubkey anywhere visible
      expect(giftWrap.pubkey).not.toBe(alicePubkey);
      expect(JSON.stringify(giftWrap.tags)).not.toContain(alicePubkey);

      // Content should be encrypted blob
      expect(giftWrap.content).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64-like
    });

    it('should only reveal recipient in p tag', async () => {
      await sendDM('Private', bobPubkey, alicePrivkey, mockRelay);

      const giftWrap = publishedEvent!;
      const pTags = giftWrap.tags.filter((t) => t[0] === 'p');

      expect(pTags).toHaveLength(1);
      expect(pTags[0][1]).toBe(bobPubkey);

      // No other identifying tags
      const otherTags = giftWrap.tags.filter((t) => t[0] !== 'p');
      expect(otherTags).toHaveLength(0);
    });
  });
});
