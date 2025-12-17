/**
 * Tests for Nostr Events Helper Module
 */

import { describe, it, expect } from 'vitest';
import {
  createChannelMessage,
  createUserMetadata,
  createDeletionEvent,
  createTextNote,
  createReaction,
  signEvent,
  verifyEventSignature,
  parseChannelMessage,
  parseUserMetadata,
  getEventTags,
  getEventTag,
  npubEncode,
  npubDecode,
  noteEncode,
  noteDecode,
  nsecEncode,
  nsecDecode,
  channelMessagesFilter,
  userMetadataFilter,
  dmFilter,
  nowSeconds,
  formatRelativeTime,
  isValidEventStructure,
  isValidEvent,
  eventReferences,
  eventMentions,
  EventKind,
  type NostrEvent,
  type UserProfile,
} from '../src/lib/nostr';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

describe('Nostr Events Module', () => {
  const secretKey = generateSecretKey();
  const privkey = bytesToHex(secretKey);
  const pubkey = getPublicKey(secretKey);

  describe('Event Creation', () => {
    it('should create a channel message event', () => {
      const content = 'Hello, channel!';
      const channelId = 'channel123';
      const event = createChannelMessage(content, channelId, privkey);

      expect(event.kind).toBe(EventKind.CHANNEL_MESSAGE);
      expect(event.content).toBe(content);
      expect(event.pubkey).toBe(pubkey);
      expect(event.tags).toContainEqual(['e', channelId, '', 'root']);
      expect(event.sig).toBeDefined();
    });

    it('should create a user metadata event', () => {
      const profile: UserProfile = {
        name: 'Alice',
        about: 'Test user',
        picture: 'https://example.com/pic.jpg',
      };
      const event = createUserMetadata(profile, privkey);

      expect(event.kind).toBe(EventKind.METADATA);
      expect(event.pubkey).toBe(pubkey);
      expect(JSON.parse(event.content)).toEqual(profile);
    });

    it('should create a deletion event', () => {
      const eventIds = ['event1', 'event2', 'event3'];
      const reason = 'Spam';
      const event = createDeletionEvent(eventIds, privkey, reason);

      expect(event.kind).toBe(EventKind.DELETION);
      expect(event.content).toBe(reason);
      expect(event.tags).toHaveLength(3);
      eventIds.forEach(id => {
        expect(event.tags).toContainEqual(['e', id]);
      });
    });

    it('should create a text note event', () => {
      const content = 'This is a note';
      const event = createTextNote(content, privkey);

      expect(event.kind).toBe(EventKind.TEXT_NOTE);
      expect(event.content).toBe(content);
      expect(event.pubkey).toBe(pubkey);
    });

    it('should create a text note with reply', () => {
      const content = 'This is a reply';
      const replyTo = 'event123';
      const event = createTextNote(content, privkey, replyTo);

      expect(event.tags).toContainEqual(['e', replyTo, '', 'reply']);
    });

    it('should create a reaction event', () => {
      const eventId = 'event123';
      const authorPubkey = 'author123';
      const event = createReaction(eventId, authorPubkey, privkey);

      expect(event.kind).toBe(EventKind.REACTION);
      expect(event.content).toBe('+');
      expect(event.tags).toContainEqual(['e', eventId]);
      expect(event.tags).toContainEqual(['p', authorPubkey]);
    });
  });

  describe('Event Signing and Verification', () => {
    it('should sign an event template', () => {
      const template = {
        kind: EventKind.TEXT_NOTE,
        created_at: nowSeconds(),
        tags: [],
        content: 'Test',
      };
      const event = signEvent(template, privkey);

      expect(event.sig).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.pubkey).toBe(pubkey);
    });

    it('should verify a valid event signature', () => {
      const event = createTextNote('Test', privkey);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should reject an invalid event signature', () => {
      const event = createTextNote('Test', privkey);
      // Tamper with the signature (replace with completely different valid hex)
      event.sig = '0'.repeat(128);
      expect(verifyEventSignature(event)).toBe(false);
    });
  });

  describe('Event Parsing', () => {
    it('should parse a channel message', () => {
      const content = 'Hello, channel!';
      const channelId = 'channel123';
      const event = createChannelMessage(content, channelId, privkey);
      const parsed = parseChannelMessage(event);

      expect(parsed).not.toBeNull();
      expect(parsed?.content).toBe(content);
      expect(parsed?.channelId).toBe(channelId);
      expect(parsed?.author).toBe(pubkey);
      expect(parsed?.eventId).toBe(event.id);
    });

    it('should return null for non-channel message', () => {
      const event = createTextNote('Test', privkey);
      const parsed = parseChannelMessage(event);
      expect(parsed).toBeNull();
    });

    it('should parse user metadata', () => {
      const profile: UserProfile = {
        name: 'Alice',
        about: 'Test user',
      };
      const event = createUserMetadata(profile, privkey);
      const parsed = parseUserMetadata(event);

      expect(parsed).toEqual(profile);
    });

    it('should return null for invalid metadata', () => {
      const event = createTextNote('Test', privkey);
      const parsed = parseUserMetadata(event);
      expect(parsed).toBeNull();
    });

    it('should get event tags by name', () => {
      const event = createChannelMessage('Test', 'channel1', privkey);
      event.tags.push(['p', 'user1']);
      event.tags.push(['p', 'user2']);

      const eTags = getEventTags(event, 'e');
      const pTags = getEventTags(event, 'p');

      expect(eTags).toContain('channel1');
      expect(pTags).toEqual(['user1', 'user2']);
    });

    it('should get first event tag', () => {
      const event = createChannelMessage('Test', 'channel1', privkey);
      const tag = getEventTag(event, 'e');
      expect(tag).toBe('channel1');
    });

    it('should detect event references', () => {
      const targetId = 'event123';
      const event = createTextNote('Test', privkey, targetId);
      expect(eventReferences(event, targetId)).toBe(true);
      expect(eventReferences(event, 'other')).toBe(false);
    });

    it('should detect event mentions', () => {
      const targetPubkey = 'user123';
      const event = createReaction('event1', targetPubkey, privkey);
      expect(eventMentions(event, targetPubkey)).toBe(true);
      expect(eventMentions(event, 'other')).toBe(false);
    });
  });

  describe('NIP-19 Encoding/Decoding', () => {
    it('should encode and decode npub', () => {
      const npub = npubEncode(pubkey);
      expect(npub).toMatch(/^npub1/);
      expect(npubDecode(npub)).toBe(pubkey);
    });

    it('should encode and decode note', () => {
      const event = createTextNote('Test', privkey);
      const note = noteEncode(event.id);
      expect(note).toMatch(/^note1/);
      expect(noteDecode(note)).toBe(event.id);
    });

    it('should encode and decode nsec', () => {
      const nsec = nsecEncode(privkey);
      expect(nsec).toMatch(/^nsec1/);
      expect(nsecDecode(nsec)).toBe(privkey);
    });

    it('should throw on invalid npub decode', () => {
      const nsec = nsecEncode(privkey);
      expect(() => npubDecode(nsec)).toThrow();
    });

    it('should throw on invalid note decode', () => {
      const npub = npubEncode(pubkey);
      expect(() => noteDecode(npub)).toThrow();
    });
  });

  describe('Event Filters', () => {
    it('should create channel messages filter', () => {
      const channelId = 'channel123';
      const since = nowSeconds() - 3600;
      const filter = channelMessagesFilter(channelId, since, 50);

      expect(filter.kinds).toEqual([EventKind.CHANNEL_MESSAGE]);
      expect(filter['#e']).toEqual([channelId]);
      expect(filter.since).toBe(since);
      expect(filter.limit).toBe(50);
    });

    it('should create user metadata filter', () => {
      const pubkeys = ['user1', 'user2', 'user3'];
      const filter = userMetadataFilter(pubkeys);

      expect(filter.kinds).toEqual([EventKind.METADATA]);
      expect(filter.authors).toEqual(pubkeys);
    });

    it('should create DM filter', () => {
      const userPubkey = pubkey;
      const since = nowSeconds() - 3600;
      const filter = dmFilter(userPubkey, since, 25);

      expect(filter.kinds).toEqual([EventKind.ENCRYPTED_DM]);
      expect(filter['#p']).toEqual([userPubkey]);
      expect(filter.since).toBe(since);
      expect(filter.limit).toBe(25);
    });
  });

  describe('Timestamp Utilities', () => {
    it('should get current timestamp', () => {
      const now = nowSeconds();
      const expected = Math.floor(Date.now() / 1000);
      expect(now).toBeCloseTo(expected, 1);
    });

    it('should format relative time - just now', () => {
      const timestamp = nowSeconds() - 30;
      expect(formatRelativeTime(timestamp)).toBe('just now');
    });

    it('should format relative time - minutes', () => {
      const timestamp = nowSeconds() - 300; // 5 min ago
      expect(formatRelativeTime(timestamp)).toMatch(/5 mins? ago/);
    });

    it('should format relative time - hours', () => {
      const timestamp = nowSeconds() - 7200; // 2 hours ago
      expect(formatRelativeTime(timestamp)).toMatch(/2 hours? ago/);
    });

    it('should format relative time - days', () => {
      const timestamp = nowSeconds() - 172800; // 2 days ago
      expect(formatRelativeTime(timestamp)).toMatch(/2 days? ago/);
    });

    it('should format relative time - weeks', () => {
      const timestamp = nowSeconds() - 1209600; // 2 weeks ago
      expect(formatRelativeTime(timestamp)).toMatch(/2 weeks? ago/);
    });

    it('should format relative time - months', () => {
      const timestamp = nowSeconds() - 5184000; // 2 months ago
      expect(formatRelativeTime(timestamp)).toMatch(/2 months? ago/);
    });

    it('should format relative time - years', () => {
      const timestamp = nowSeconds() - 63072000; // 2 years ago
      expect(formatRelativeTime(timestamp)).toMatch(/2 years? ago/);
    });

    it('should format future timestamp', () => {
      const timestamp = nowSeconds() + 3600;
      expect(formatRelativeTime(timestamp)).toBe('in the future');
    });
  });

  describe('Event Validation', () => {
    it('should validate correct event structure', () => {
      const event = createTextNote('Test', privkey);
      expect(isValidEventStructure(event)).toBe(true);
    });

    it('should reject invalid event structure', () => {
      expect(isValidEventStructure({})).toBe(false);
      expect(isValidEventStructure(null)).toBe(false);
      expect(isValidEventStructure({ id: 'test' })).toBe(false);
    });

    it('should validate and verify valid event', () => {
      const event = createTextNote('Test', privkey);
      expect(isValidEvent(event)).toBe(true);
    });

    it('should reject invalid event', () => {
      const event = createTextNote('Test', privkey);
      // Tamper with the signature (replace with completely different valid hex)
      event.sig = '0'.repeat(128);
      expect(isValidEvent(event)).toBe(false);
    });
  });
});
