import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db, type DBMessage, type DBChannel, type DBUser } from '$lib/db';
import {
  exportToJSON,
  exportToCSV,
  exportToText,
  filterMessages,
  type ExportOptions
} from '$lib/utils/export';

describe('Export Flow Integration', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.delete();
    await db.open();
  });

  const createMockChannel = async (id: string, name: string): Promise<DBChannel> => {
    const channel: DBChannel = {
      id,
      name,
      about: `Test channel ${name}`,
      picture: null,
      creatorPubkey: 'creator1',
      created_at: Date.now() / 1000,
      isPrivate: false,
      isEncrypted: false,
      memberPubkeys: ['user1', 'user2'],
      adminPubkeys: ['creator1'],
      kind: 40,
      tags: [['name', name]]
    };

    await db.channels.add(channel);
    return channel;
  };

  const createMockUser = async (pubkey: string, name: string): Promise<DBUser> => {
    const user: DBUser = {
      pubkey,
      name,
      displayName: name,
      avatar: null,
      about: null,
      nip05: null,
      lud16: null,
      website: null,
      banner: null,
      created_at: null,
      updated_at: null,
      cached_at: Date.now() / 1000
    };

    await db.users.add(user);
    return user;
  };

  const createMockMessage = async (
    id: string,
    channelId: string,
    pubkey: string,
    content: string,
    created_at: number
  ): Promise<DBMessage> => {
    const message: DBMessage = {
      id,
      channelId,
      pubkey,
      content,
      created_at,
      encrypted: false,
      deleted: false,
      kind: 42,
      tags: [],
      sig: `sig_${id}`
    };

    await db.messages.add(message);
    return message;
  };

  describe('Full Export Workflow', () => {
    it('should export all messages across channels', async () => {
      // Setup test data
      await createMockChannel('ch1', 'General');
      await createMockChannel('ch2', 'Random');
      await createMockUser('user1', 'Alice');
      await createMockUser('user2', 'Bob');

      const baseTime = Date.now() / 1000;
      await createMockMessage('msg1', 'ch1', 'user1', 'Message 1', baseTime);
      await createMockMessage('msg2', 'ch1', 'user2', 'Message 2', baseTime + 100);
      await createMockMessage('msg3', 'ch2', 'user1', 'Message 3', baseTime + 200);

      // Export all messages
      const messages = await db.messages.toArray();
      const options: ExportOptions = { includeMetadata: true };

      const jsonExport = exportToJSON(messages, options);
      const csvExport = exportToCSV(messages, options);
      const textExport = exportToText(messages, options);

      // Verify JSON export
      const parsed = JSON.parse(jsonExport);
      expect(parsed.messageCount).toBe(3);
      expect(parsed.messages).toHaveLength(3);

      // Verify CSV export
      const csvLines = csvExport.split('\n');
      expect(csvLines.length).toBeGreaterThan(3); // Header + 3 messages

      // Verify text export
      expect(textExport).toContain('Message 1');
      expect(textExport).toContain('Message 2');
      expect(textExport).toContain('Message 3');
    });

    it('should filter by channel', async () => {
      await createMockChannel('ch1', 'General');
      await createMockChannel('ch2', 'Random');

      const baseTime = Date.now() / 1000;
      await createMockMessage('msg1', 'ch1', 'user1', 'General msg', baseTime);
      await createMockMessage('msg2', 'ch2', 'user1', 'Random msg', baseTime + 100);

      const allMessages = await db.messages.toArray();
      const options: ExportOptions = {
        channelFilter: ['ch1']
      };

      const filtered = filterMessages(allMessages, options);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].channelId).toBe('ch1');
    });

    it('should filter by date range', async () => {
      await createMockChannel('ch1', 'General');

      const baseTime = Date.now() / 1000;
      await createMockMessage('msg1', 'ch1', 'user1', 'Old msg', baseTime - 1000);
      await createMockMessage('msg2', 'ch1', 'user1', 'Recent msg', baseTime);
      await createMockMessage('msg3', 'ch1', 'user1', 'Future msg', baseTime + 1000);

      const allMessages = await db.messages.toArray();
      const options: ExportOptions = {
        dateRange: {
          start: baseTime - 100,
          end: baseTime + 100
        }
      };

      const filtered = filterMessages(allMessages, options);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg2');
    });

    it('should handle deleted messages correctly', async () => {
      await createMockChannel('ch1', 'General');

      const baseTime = Date.now() / 1000;
      const msg1 = await createMockMessage('msg1', 'ch1', 'user1', 'Active msg', baseTime);
      const msg2 = await createMockMessage('msg2', 'ch1', 'user1', 'Deleted msg', baseTime + 100);

      // Mark message as deleted
      await db.messages.update('msg2', { deleted: true });

      const allMessages = await db.messages.toArray();

      // Default: exclude deleted
      const withoutDeleted = filterMessages(allMessages, { includeDeleted: false });
      expect(withoutDeleted).toHaveLength(1);
      expect(withoutDeleted[0].id).toBe('msg1');

      // Include deleted
      const withDeleted = filterMessages(allMessages, { includeDeleted: true });
      expect(withDeleted).toHaveLength(2);
    });
  });

  describe('Large Dataset Export', () => {
    it('should handle 1000+ messages efficiently', async () => {
      await createMockChannel('ch1', 'General');
      await createMockUser('user1', 'Alice');

      // Create 1000 messages
      const baseTime = Date.now() / 1000;
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i}`,
        channelId: 'ch1',
        pubkey: 'user1',
        content: `Message ${i}`,
        created_at: baseTime + i,
        encrypted: false,
        deleted: false,
        kind: 42,
        tags: [],
        sig: `sig${i}`
      }));

      await db.messages.bulkAdd(messages);

      // Export all messages
      const allMessages = await db.messages.toArray();
      expect(allMessages).toHaveLength(1000);

      const options: ExportOptions = { includeMetadata: false };

      // Test JSON export
      const startTime = Date.now();
      const jsonExport = exportToJSON(allMessages, options);
      const jsonTime = Date.now() - startTime;

      expect(jsonExport).toBeDefined();
      expect(JSON.parse(jsonExport).messageCount).toBe(1000);
      expect(jsonTime).toBeLessThan(1000); // Should complete in under 1 second

      // Test CSV export
      const csvExport = exportToCSV(allMessages, options);
      const csvLines = csvExport.split('\n');
      expect(csvLines.length).toBeGreaterThan(1000);
    });
  });

  describe('Export with User Enrichment', () => {
    it('should enrich messages with user data', async () => {
      await createMockChannel('ch1', 'General');
      await createMockUser('user1', 'Alice');
      await createMockUser('user2', 'Bob');

      const baseTime = Date.now() / 1000;
      await createMockMessage('msg1', 'ch1', 'user1', 'Hello', baseTime);
      await createMockMessage('msg2', 'ch1', 'user2', 'Hi', baseTime + 100);

      // Fetch and enrich messages
      const messages = await db.messages.toArray();
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const user = await db.users.get(msg.pubkey);
          const channel = await db.channels.get(msg.channelId);
          return {
            ...msg,
            authorName: user?.name,
            channelName: channel?.name
          };
        })
      );

      // Export with enriched data
      const textExport = exportToText(enrichedMessages, { includeMetadata: false });

      expect(textExport).toContain('Alice');
      expect(textExport).toContain('Bob');
      expect(textExport).toContain('General');
    });
  });

  describe('Multiple Channel Export', () => {
    it('should group messages by channel in text export', async () => {
      await createMockChannel('ch1', 'General');
      await createMockChannel('ch2', 'Random');
      await createMockChannel('ch3', 'Development');

      const baseTime = Date.now() / 1000;
      await createMockMessage('msg1', 'ch1', 'user1', 'General 1', baseTime);
      await createMockMessage('msg2', 'ch1', 'user1', 'General 2', baseTime + 100);
      await createMockMessage('msg3', 'ch2', 'user1', 'Random 1', baseTime + 200);
      await createMockMessage('msg4', 'ch3', 'user1', 'Dev 1', baseTime + 300);

      const messages = await db.messages.toArray();
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const channel = await db.channels.get(msg.channelId);
          return {
            ...msg,
            channelName: channel?.name
          };
        })
      );

      const textExport = exportToText(enrichedMessages, { includeMetadata: false });

      expect(textExport).toContain('Channel: General');
      expect(textExport).toContain('Channel: Random');
      expect(textExport).toContain('Channel: Development');
    });
  });
});
