import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, type DBMessage } from '$lib/db';
import {
  searchMessages,
  buildSearchIndex,
  getIndexStats,
  indexNewMessage,
  removeDeletedMessage
} from '$lib/utils/searchIndex';

describe('Search Index', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.clearAll();
    await db.clearSearchIndex();
  });

  afterEach(async () => {
    // Cleanup after tests
    await db.clearAll();
    await db.clearSearchIndex();
  });

  describe('Tokenization', () => {
    it('should tokenize message content correctly', () => {
      const text = 'Hello World! This is a test message.';
      const tokens = db.tokenize(text);

      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('test');
      expect(tokens).toContain('message');

      // Stop words should be filtered
      expect(tokens).not.toContain('this');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('a');
    });

    it('should handle special characters', () => {
      const text = 'Email: test@example.com, price: $99.99';
      const tokens = db.tokenize(text);

      expect(tokens).toContain('email');
      expect(tokens).toContain('price');
      expect(tokens).toContain('99');
    });
  });

  describe('Index Building', () => {
    it('should build index from messages', async () => {
      // Create test messages
      const messages: DBMessage[] = [
        {
          id: 'msg1',
          channelId: 'ch1',
          pubkey: 'user1',
          content: 'Hello world from Alice',
          created_at: Date.now() / 1000,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig1'
        },
        {
          id: 'msg2',
          channelId: 'ch1',
          pubkey: 'user2',
          content: 'Bob says hello too',
          created_at: Date.now() / 1000,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig2'
        }
      ];

      await db.messages.bulkPut(messages);
      await buildSearchIndex();

      const stats = await getIndexStats();
      expect(stats.totalIndexed).toBe(2);
    });

    it('should not index deleted messages', async () => {
      const messages: DBMessage[] = [
        {
          id: 'msg1',
          channelId: 'ch1',
          pubkey: 'user1',
          content: 'Active message',
          created_at: Date.now() / 1000,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig1'
        },
        {
          id: 'msg2',
          channelId: 'ch1',
          pubkey: 'user2',
          content: 'Deleted message',
          created_at: Date.now() / 1000,
          encrypted: false,
          deleted: true,
          kind: 1,
          tags: [],
          sig: 'sig2'
        }
      ];

      await db.messages.bulkPut(messages);
      await buildSearchIndex();

      const stats = await getIndexStats();
      expect(stats.totalIndexed).toBe(1);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Create test dataset
      const messages: DBMessage[] = [
        {
          id: 'msg1',
          channelId: 'general',
          pubkey: 'alice',
          content: 'JavaScript is a versatile programming language',
          created_at: Date.now() / 1000 - 3600,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig1'
        },
        {
          id: 'msg2',
          channelId: 'general',
          pubkey: 'bob',
          content: 'Python is great for data science',
          created_at: Date.now() / 1000 - 1800,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig2'
        },
        {
          id: 'msg3',
          channelId: 'tech',
          pubkey: 'charlie',
          content: 'JavaScript and Python are both popular',
          created_at: Date.now() / 1000,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: 'sig3'
        }
      ];

      await db.messages.bulkPut(messages);
      await buildSearchIndex();
    });

    it('should search and return results', async () => {
      const response = await searchMessages('javascript');

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.stats.totalResults).toBeGreaterThan(0);
    });

    it('should support AND operator', async () => {
      const response = await searchMessages('javascript AND python');

      expect(response.results.length).toBe(1);
      expect(response.results[0].messageId).toBe('msg3');
    });

    it('should support OR operator', async () => {
      const response = await searchMessages('javascript OR python');

      expect(response.results.length).toBe(3);
    });

    it('should filter by channel', async () => {
      const response = await searchMessages('python', {
        channelId: 'general'
      });

      expect(response.results.length).toBe(1);
      expect(response.results[0].messageId).toBe('msg2');
    });

    it('should filter by author', async () => {
      const response = await searchMessages('python', {
        authorPubkey: 'bob'
      });

      expect(response.results.length).toBe(1);
      expect(response.results[0].messageId).toBe('msg2');
    });

    it('should filter by date range', async () => {
      const now = Date.now() / 1000;
      const response = await searchMessages('python', {
        dateRange: {
          start: now - 3000,
          end: now - 1000
        }
      });

      expect(response.results.length).toBe(1);
      expect(response.results[0].messageId).toBe('msg2');
    });

    it('should rank results by relevance', async () => {
      const response = await searchMessages('javascript');

      // First result should be the one with "javascript" more prominent
      expect(response.results[0].score).toBeGreaterThan(0);

      // Results should be sorted by score
      for (let i = 1; i < response.results.length; i++) {
        expect(response.results[i - 1].score).toBeGreaterThanOrEqual(
          response.results[i].score
        );
      }
    });

    it('should provide highlights', async () => {
      const response = await searchMessages('javascript');

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].highlights.length).toBeGreaterThan(0);
    });

    it('should handle pagination', async () => {
      const page1 = await searchMessages('python', { limit: 1, offset: 0 });
      const page2 = await searchMessages('python', { limit: 1, offset: 1 });

      expect(page1.results.length).toBe(1);
      expect(page2.results.length).toBe(1);
      expect(page1.results[0].messageId).not.toBe(page2.results[0].messageId);
    });

    it('should handle empty query', async () => {
      const response = await searchMessages('');

      expect(response.results.length).toBe(0);
      expect(response.stats.totalResults).toBe(0);
    });

    it('should handle no results', async () => {
      const response = await searchMessages('nonexistent');

      expect(response.results.length).toBe(0);
      expect(response.stats.totalResults).toBe(0);
    });
  });

  describe('Real-time Indexing', () => {
    it('should index new messages automatically', async () => {
      const message: DBMessage = {
        id: 'new1',
        channelId: 'ch1',
        pubkey: 'user1',
        content: 'Newly created message',
        created_at: Date.now() / 1000,
        encrypted: false,
        deleted: false,
        kind: 1,
        tags: [],
        sig: 'sig1'
      };

      await indexNewMessage(message);

      const response = await searchMessages('newly created');
      expect(response.results.length).toBe(1);
      expect(response.results[0].messageId).toBe('new1');
    });

    it('should remove deleted messages from index', async () => {
      const message: DBMessage = {
        id: 'del1',
        channelId: 'ch1',
        pubkey: 'user1',
        content: 'Message to be deleted',
        created_at: Date.now() / 1000,
        encrypted: false,
        deleted: false,
        kind: 1,
        tags: [],
        sig: 'sig1'
      };

      await indexNewMessage(message);
      await removeDeletedMessage('del1');

      const response = await searchMessages('deleted');
      expect(response.results.length).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create 1000 messages
      const messages: DBMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        messages.push({
          id: `msg${i}`,
          channelId: `ch${i % 10}`,
          pubkey: `user${i % 100}`,
          content: `Test message ${i} with various keywords like search index performance`,
          created_at: Date.now() / 1000 - i * 60,
          encrypted: false,
          deleted: false,
          kind: 1,
          tags: [],
          sig: `sig${i}`
        });
      }

      await db.messages.bulkPut(messages);

      const buildStart = performance.now();
      await buildSearchIndex();
      const buildEnd = performance.now();
      const buildTime = buildEnd - buildStart;

      console.log(`Built index for 1000 messages in ${buildTime.toFixed(2)}ms`);
      expect(buildTime).toBeLessThan(5000); // Should complete in under 5 seconds

      const searchStart = performance.now();
      const response = await searchMessages('search');
      const searchEnd = performance.now();
      const searchTime = searchEnd - searchStart;

      console.log(`Searched 1000 messages in ${searchTime.toFixed(2)}ms`);
      expect(searchTime).toBeLessThan(500); // Searches should be fast
      expect(response.results.length).toBeGreaterThan(0);
    });
  });

  describe('Search History', () => {
    it('should save search history', async () => {
      await searchMessages('test query');

      const history = await db.getSearchHistory(5);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].query).toBe('test query');
    });

    it('should limit history to 50 entries', async () => {
      // Create 60 search queries
      for (let i = 0; i < 60; i++) {
        await db.addSearchHistory(`query${i}`, i);
      }

      const history = await db.getSearchHistory(100);
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });
});
