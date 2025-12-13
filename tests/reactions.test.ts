/**
 * NIP-25 Reactions Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  createReactionEvent,
  parseReactionEvent,
  CommonReactions,
  normalizeReactionContent,
  isLikeReaction,
  isDislikeReaction,
  groupReactionsByContent,
  countReactions,
  hasUserReacted,
  getUserReaction,
  getReactionsForEvent,
  getPopularReactions,
  isValidReactionContent,
  getReactionEmoji,
  type ReactionData,
} from '../src/lib/nostr/reactions';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

describe('NIP-25 Reactions', () => {
  const privkey = bytesToHex(generateSecretKey());
  const pubkey = getPublicKey(privkey);
  const messageId = 'test-message-id-' + Date.now();
  const authorPubkey = 'test-author-pubkey';

  describe('createReactionEvent', () => {
    it('should create a valid reaction event', () => {
      const event = createReactionEvent(messageId, CommonReactions.LIKE, privkey);

      expect(event).toBeDefined();
      expect(event.kind).toBe(7);
      expect(event.content).toBe(CommonReactions.LIKE);
      expect(event.pubkey).toBe(pubkey);
      expect(event.tags).toContainEqual(['e', messageId]);
    });

    it('should include author pubkey tag when provided', () => {
      const event = createReactionEvent(
        messageId,
        CommonReactions.LOVE,
        privkey,
        authorPubkey
      );

      expect(event.tags).toContainEqual(['e', messageId]);
      expect(event.tags).toContainEqual(['p', authorPubkey]);
    });

    it('should support emoji reactions', () => {
      const event = createReactionEvent(
        messageId,
        CommonReactions.FIRE,
        privkey,
        authorPubkey
      );

      expect(event.content).toBe(CommonReactions.FIRE);
    });
  });

  describe('parseReactionEvent', () => {
    it('should parse a valid reaction event', () => {
      const event = createReactionEvent(
        messageId,
        CommonReactions.LIKE,
        privkey,
        authorPubkey
      );

      const parsed = parseReactionEvent(event);

      expect(parsed).toBeDefined();
      expect(parsed?.eventId).toBe(messageId);
      expect(parsed?.authorPubkey).toBe(authorPubkey);
      expect(parsed?.content).toBe(CommonReactions.LIKE);
      expect(parsed?.reactorPubkey).toBe(pubkey);
    });

    it('should return null for non-reaction events', () => {
      const textNote = {
        id: 'test-id',
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1, // Text note
        tags: [],
        content: 'Hello world',
        sig: 'test-sig',
      };

      const parsed = parseReactionEvent(textNote);
      expect(parsed).toBeNull();
    });

    it('should return null for reaction without event tag', () => {
      const invalidReaction = {
        id: 'test-id',
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 7,
        tags: [], // Missing 'e' tag
        content: '+',
        sig: 'test-sig',
      };

      const parsed = parseReactionEvent(invalidReaction);
      expect(parsed).toBeNull();
    });
  });

  describe('normalizeReactionContent', () => {
    it('should normalize + to LIKE', () => {
      expect(normalizeReactionContent('+')).toBe(CommonReactions.LIKE);
      expect(normalizeReactionContent(' + ')).toBe(CommonReactions.LIKE);
      expect(normalizeReactionContent('like')).toBe(CommonReactions.LIKE);
      expect(normalizeReactionContent('👍')).toBe(CommonReactions.LIKE);
    });

    it('should normalize - to DISLIKE', () => {
      expect(normalizeReactionContent('-')).toBe(CommonReactions.DISLIKE);
      expect(normalizeReactionContent(' - ')).toBe(CommonReactions.DISLIKE);
      expect(normalizeReactionContent('dislike')).toBe(CommonReactions.DISLIKE);
      expect(normalizeReactionContent('👎')).toBe(CommonReactions.DISLIKE);
    });

    it('should preserve emoji reactions', () => {
      expect(normalizeReactionContent(CommonReactions.LOVE)).toBe(CommonReactions.LOVE);
      expect(normalizeReactionContent(CommonReactions.FIRE)).toBe(CommonReactions.FIRE);
    });
  });

  describe('isLikeReaction & isDislikeReaction', () => {
    it('should identify like reactions', () => {
      expect(isLikeReaction('+')).toBe(true);
      expect(isLikeReaction('like')).toBe(true);
      expect(isLikeReaction('👍')).toBe(true);
      expect(isLikeReaction('-')).toBe(false);
    });

    it('should identify dislike reactions', () => {
      expect(isDislikeReaction('-')).toBe(true);
      expect(isDislikeReaction('dislike')).toBe(true);
      expect(isDislikeReaction('👎')).toBe(true);
      expect(isDislikeReaction('+')).toBe(false);
    });
  });

  describe('getReactionEmoji', () => {
    it('should convert + to thumbs up emoji', () => {
      expect(getReactionEmoji('+')).toBe('👍');
    });

    it('should convert - to thumbs down emoji', () => {
      expect(getReactionEmoji('-')).toBe('👎');
    });

    it('should preserve other emojis', () => {
      expect(getReactionEmoji('❤️')).toBe('❤️');
      expect(getReactionEmoji('🔥')).toBe('🔥');
    });
  });

  describe('isValidReactionContent', () => {
    it('should accept valid reactions', () => {
      expect(isValidReactionContent('+')).toBe(true);
      expect(isValidReactionContent('-')).toBe(true);
      expect(isValidReactionContent('❤️')).toBe(true);
      expect(isValidReactionContent('🔥')).toBe(true);
    });

    it('should reject invalid reactions', () => {
      expect(isValidReactionContent('')).toBe(false);
      expect(isValidReactionContent('x'.repeat(101))).toBe(false);
    });
  });

  describe('groupReactionsByContent', () => {
    it('should group reactions by normalized content', () => {
      const reactions: ReactionData[] = [
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user1',
          timestamp: 1000,
          reactionEventId: 'r1',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: 'like',
          reactorPubkey: 'user2',
          timestamp: 1001,
          reactionEventId: 'r2',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '❤️',
          reactorPubkey: 'user3',
          timestamp: 1002,
          reactionEventId: 'r3',
        },
      ];

      const grouped = groupReactionsByContent(reactions);

      expect(grouped.get(CommonReactions.LIKE)).toEqual(['user1', 'user2']);
      expect(grouped.get(CommonReactions.LOVE)).toEqual(['user3']);
    });

    it('should not duplicate reactions from same user', () => {
      const reactions: ReactionData[] = [
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user1',
          timestamp: 1000,
          reactionEventId: 'r1',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user1',
          timestamp: 1001,
          reactionEventId: 'r2',
        },
      ];

      const grouped = groupReactionsByContent(reactions);
      expect(grouped.get(CommonReactions.LIKE)).toEqual(['user1']);
    });
  });

  describe('countReactions', () => {
    it('should count reactions correctly', () => {
      const reactions: ReactionData[] = [
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user1',
          timestamp: 1000,
          reactionEventId: 'r1',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user2',
          timestamp: 1001,
          reactionEventId: 'r2',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '❤️',
          reactorPubkey: 'user3',
          timestamp: 1002,
          reactionEventId: 'r3',
        },
      ];

      const counts = countReactions(reactions);

      expect(counts.get(CommonReactions.LIKE)).toBe(2);
      expect(counts.get(CommonReactions.LOVE)).toBe(1);
    });
  });

  describe('hasUserReacted', () => {
    const reactions: ReactionData[] = [
      {
        eventId: messageId,
        authorPubkey,
        content: '+',
        reactorPubkey: 'user1',
        timestamp: 1000,
        reactionEventId: 'r1',
      },
      {
        eventId: messageId,
        authorPubkey,
        content: '❤️',
        reactorPubkey: 'user2',
        timestamp: 1001,
        reactionEventId: 'r2',
      },
    ];

    it('should detect user reactions', () => {
      expect(hasUserReacted(reactions, 'user1')).toBe(true);
      expect(hasUserReacted(reactions, 'user2')).toBe(true);
      expect(hasUserReacted(reactions, 'user3')).toBe(false);
    });

    it('should detect specific reaction content', () => {
      expect(hasUserReacted(reactions, 'user1', '+')).toBe(true);
      expect(hasUserReacted(reactions, 'user1', '❤️')).toBe(false);
      expect(hasUserReacted(reactions, 'user2', '❤️')).toBe(true);
    });
  });

  describe('getUserReaction', () => {
    const reactions: ReactionData[] = [
      {
        eventId: messageId,
        authorPubkey,
        content: '+',
        reactorPubkey: 'user1',
        timestamp: 1000,
        reactionEventId: 'r1',
      },
    ];

    it('should return user reaction', () => {
      const reaction = getUserReaction(reactions, 'user1');
      expect(reaction).toBeDefined();
      expect(reaction?.content).toBe('+');
    });

    it('should return null for non-existent user', () => {
      const reaction = getUserReaction(reactions, 'user2');
      expect(reaction).toBeNull();
    });
  });

  describe('getPopularReactions', () => {
    it('should return most popular reactions', () => {
      const reactions: ReactionData[] = [
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user1',
          timestamp: 1000,
          reactionEventId: 'r1',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user2',
          timestamp: 1001,
          reactionEventId: 'r2',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '+',
          reactorPubkey: 'user3',
          timestamp: 1002,
          reactionEventId: 'r3',
        },
        {
          eventId: messageId,
          authorPubkey,
          content: '❤️',
          reactorPubkey: 'user4',
          timestamp: 1003,
          reactionEventId: 'r4',
        },
      ];

      const popular = getPopularReactions(reactions, 2);

      expect(popular).toHaveLength(2);
      expect(popular[0][0]).toBe(CommonReactions.LIKE);
      expect(popular[0][1]).toBe(3);
      expect(popular[1][0]).toBe(CommonReactions.LOVE);
      expect(popular[1][1]).toBe(1);
    });
  });
});
