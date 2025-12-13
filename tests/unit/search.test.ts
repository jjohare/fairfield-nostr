import { describe, it, expect } from 'vitest';
import { highlightMatch, matchesSearch, filterMessages } from '$lib/utils/search';
import type { Message } from '$lib/types/channel';

describe('Search Utilities', () => {
  describe('highlightMatch', () => {
    it('highlights matching text', () => {
      const result = highlightMatch('Hello world', 'world');
      expect(result).toContain('<mark');
      expect(result).toContain('world');
    });

    it('handles case insensitive matching', () => {
      const result = highlightMatch('Hello World', 'hello');
      expect(result).toContain('<mark');
    });

    it('returns escaped text when no query', () => {
      const result = highlightMatch('Hello world', '');
      expect(result).toBe('Hello world');
    });

    it('escapes HTML in text', () => {
      const result = highlightMatch('<script>alert("xss")</script>', '');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('matchesSearch', () => {
    const mockMessage: Message = {
      id: '1',
      channelId: 'channel1',
      authorPubkey: 'pubkey1',
      content: 'Hello world this is a test',
      createdAt: Date.now() / 1000,
      isEncrypted: false
    };

    it('returns true for matching query', () => {
      expect(matchesSearch(mockMessage, 'hello')).toBe(true);
      expect(matchesSearch(mockMessage, 'world')).toBe(true);
      expect(matchesSearch(mockMessage, 'test')).toBe(true);
    });

    it('returns false for non-matching query', () => {
      expect(matchesSearch(mockMessage, 'notfound')).toBe(false);
    });

    it('returns true for empty query', () => {
      expect(matchesSearch(mockMessage, '')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(matchesSearch(mockMessage, 'HELLO')).toBe(true);
      expect(matchesSearch(mockMessage, 'WoRlD')).toBe(true);
    });
  });

  describe('filterMessages', () => {
    const now = Date.now() / 1000;
    const messages: Message[] = [
      {
        id: '1',
        channelId: 'channel1',
        authorPubkey: 'user1',
        content: 'First message',
        createdAt: now - 3600, // 1 hour ago
        isEncrypted: false
      },
      {
        id: '2',
        channelId: 'channel1',
        authorPubkey: 'user2',
        content: 'Second message',
        createdAt: now - 1800, // 30 minutes ago
        isEncrypted: false
      },
      {
        id: '3',
        channelId: 'channel1',
        authorPubkey: 'user1',
        content: 'Third message',
        createdAt: now - 900, // 15 minutes ago
        isEncrypted: false
      }
    ];

    it('filters by text query', () => {
      const result = filterMessages(messages, 'first', { scope: 'all' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('filters by user scope', () => {
      const result = filterMessages(messages, '', { scope: 'user' }, 'user1');
      expect(result).toHaveLength(2);
      expect(result.every(m => m.authorPubkey === 'user1')).toBe(true);
    });

    it('filters by date range', () => {
      const dateFrom = new Date((now - 2000) * 1000);
      const result = filterMessages(messages, '', { scope: 'all', dateFrom });
      expect(result).toHaveLength(2); // Should include messages 2 and 3
    });

    it('combines multiple filters', () => {
      const result = filterMessages(messages, 'message', { scope: 'user' }, 'user1');
      expect(result).toHaveLength(2);
      expect(result.every(m => m.authorPubkey === 'user1')).toBe(true);
      expect(result.every(m => m.content.includes('message'))).toBe(true);
    });

    it('returns all messages with no filters', () => {
      const result = filterMessages(messages, '', { scope: 'all' });
      expect(result).toHaveLength(3);
    });
  });
});
