import { describe, it, expect } from 'vitest';
import {
  exportToJSON,
  exportToCSV,
  exportToText,
  filterMessages,
  processInChunks,
  estimateExportSize,
  type ExportOptions,
  type ExportMessage
} from '$lib/utils/export';
import type { DBMessage } from '$lib/db';

describe('Export Utils', () => {
  const mockMessages: DBMessage[] = [
    {
      id: 'msg1',
      channelId: 'ch1',
      pubkey: 'pubkey1',
      content: 'Hello, world!',
      created_at: 1700000000,
      encrypted: false,
      deleted: false,
      kind: 42,
      tags: [],
      sig: 'sig1'
    },
    {
      id: 'msg2',
      channelId: 'ch1',
      pubkey: 'pubkey2',
      content: 'Test message',
      created_at: 1700001000,
      encrypted: true,
      deleted: false,
      kind: 42,
      tags: [['p', 'pubkey1']],
      sig: 'sig2'
    },
    {
      id: 'msg3',
      channelId: 'ch2',
      pubkey: 'pubkey1',
      content: 'Deleted message',
      created_at: 1700002000,
      encrypted: false,
      deleted: true,
      kind: 42,
      tags: [],
      sig: 'sig3'
    }
  ];

  const enrichedMessages: ExportMessage[] = mockMessages.map(msg => ({
    ...msg,
    authorName: msg.pubkey === 'pubkey1' ? 'Alice' : 'Bob',
    channelName: msg.channelId === 'ch1' ? 'General' : 'Random'
  }));

  describe('filterMessages', () => {
    it('should filter by date range', () => {
      const options: ExportOptions = {
        dateRange: {
          start: 1700000500,
          end: 1700001500
        }
      };

      const filtered = filterMessages(mockMessages, options);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg2');
    });

    it('should filter by channel', () => {
      const options: ExportOptions = {
        channelFilter: ['ch1']
      };

      const filtered = filterMessages(mockMessages, options);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(msg => msg.channelId === 'ch1')).toBe(true);
    });

    it('should exclude deleted messages by default', () => {
      const options: ExportOptions = {
        includeDeleted: false
      };

      const filtered = filterMessages(mockMessages, options);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(msg => !msg.deleted)).toBe(true);
    });

    it('should include deleted messages when requested', () => {
      const options: ExportOptions = {
        includeDeleted: true
      };

      const filtered = filterMessages(mockMessages, options);
      expect(filtered).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      const options: ExportOptions = {
        channelFilter: ['ch1'],
        includeDeleted: false,
        dateRange: {
          start: 1700000000,
          end: 1700001500
        }
      };

      const filtered = filterMessages(mockMessages, options);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('exportToJSON', () => {
    it('should export messages to JSON format', () => {
      const options: ExportOptions = { includeMetadata: true };
      const result = exportToJSON(enrichedMessages.slice(0, 2), options);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);

      expect(parsed.version).toBe('1.0');
      expect(parsed.messageCount).toBe(2);
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0].content).toBe('Hello, world!');
    });

    it('should exclude metadata when requested', () => {
      const options: ExportOptions = { includeMetadata: false };
      const result = exportToJSON(enrichedMessages.slice(0, 1), options);
      const parsed = JSON.parse(result);

      expect(parsed.messages[0].id).toBeDefined();
      expect(parsed.messages[0].content).toBeDefined();
      expect(parsed.messages[0].sig).toBeUndefined();
      expect(parsed.messages[0].tags).toBeUndefined();
    });
  });

  describe('exportToCSV', () => {
    it('should export messages to CSV format', () => {
      const options: ExportOptions = { includeMetadata: false };
      const result = exportToCSV(enrichedMessages.slice(0, 2), options);

      const lines = result.split('\n');
      expect(lines[0]).toContain('Timestamp');
      expect(lines[0]).toContain('Content');
      expect(lines[1]).toContain('Hello, world!');
      expect(lines[2]).toContain('Test message');
    });

    it('should escape CSV special characters', () => {
      const messageWithComma: ExportMessage = {
        ...mockMessages[0],
        content: 'Hello, world!',
        authorName: 'Test, User'
      };

      const options: ExportOptions = { includeMetadata: false };
      const result = exportToCSV([messageWithComma], options);

      expect(result).toContain('"Hello, world!"');
      expect(result).toContain('"Test, User"');
    });

    it('should include metadata when requested', () => {
      const options: ExportOptions = { includeMetadata: true };
      const result = exportToCSV(enrichedMessages.slice(0, 1), options);

      const lines = result.split('\n');
      expect(lines[0]).toContain('Encrypted');
      expect(lines[0]).toContain('Signature');
    });
  });

  describe('exportToText', () => {
    it('should export messages to text format', () => {
      const options: ExportOptions = { includeMetadata: false };
      const result = exportToText(enrichedMessages.slice(0, 2), options);

      expect(result).toContain('Fairfield Nostr Message Export');
      expect(result).toContain('Channel: General');
      expect(result).toContain('Hello, world!');
      expect(result).toContain('Test message');
    });

    it('should group messages by channel', () => {
      const options: ExportOptions = { includeMetadata: false };
      const result = exportToText(enrichedMessages, options);

      expect(result).toContain('Channel: General');
      expect(result).toContain('Channel: Random');
    });

    it('should include metadata when requested', () => {
      const options: ExportOptions = { includeMetadata: true };
      const result = exportToText(enrichedMessages.slice(0, 1), options);

      expect(result).toContain('ID:');
      expect(result).toContain('Encrypted:');
    });
  });

  describe('processInChunks', () => {
    it('should process items in chunks', async () => {
      const items = Array.from({ length: 1500 }, (_, i) => i);
      const chunkSize = 500;
      const processedChunks: number[] = [];

      await processInChunks(
        items,
        (chunk) => {
          processedChunks.push(chunk.length);
          return chunk.length;
        },
        chunkSize
      );

      expect(processedChunks).toHaveLength(3);
      expect(processedChunks[0]).toBe(500);
      expect(processedChunks[1]).toBe(500);
      expect(processedChunks[2]).toBe(500);
    });

    it('should report progress', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);
      const progressUpdates: number[] = [];

      await processInChunks(
        items,
        (chunk) => chunk,
        500,
        (progress) => progressUpdates.push(progress)
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should handle small arrays', async () => {
      const items = [1, 2, 3];
      const results = await processInChunks(items, (chunk) => chunk, 500);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 2, 3]);
    });
  });

  describe('estimateExportSize', () => {
    it('should estimate JSON export size', () => {
      const size = estimateExportSize(100, 'json');
      expect(size).toBe(50000); // 100 * 500
    });

    it('should estimate CSV export size', () => {
      const size = estimateExportSize(100, 'csv');
      expect(size).toBe(20000); // 100 * 200
    });

    it('should estimate text export size', () => {
      const size = estimateExportSize(100, 'text');
      expect(size).toBe(15000); // 100 * 150
    });

    it('should scale with message count', () => {
      const size1000 = estimateExportSize(1000, 'json');
      const size10000 = estimateExportSize(10000, 'json');

      expect(size10000).toBe(size1000 * 10);
    });
  });
});
