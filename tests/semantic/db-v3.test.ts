import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import type { DBEmbedding, DBMetadata } from '$lib/db';

/**
 * Test database version 3 migration and semantic search tables
 */
class TestDB extends Dexie {
  embeddings!: Dexie.Table<DBEmbedding, string>;
  metadata!: Dexie.Table<DBMetadata, string>;

  constructor() {
    super('TestMinimoomaNoirDB');

    // Version 1-2 schemas (minimal for migration testing)
    this.version(1).stores({
      messages: 'id, channelId',
      channels: 'id'
    });

    this.version(2).stores({
      messages: 'id, channelId',
      channels: 'id',
      searchIndex: 'id'
    });

    // Version 3: Add semantic search tables
    this.version(3).stores({
      messages: 'id, channelId',
      channels: 'id',
      searchIndex: 'id',
      embeddings: 'key, version',
      metadata: 'key'
    });
  }
}

describe('Database Version 3 - Semantic Search Tables', () => {
  let db: TestDB;

  beforeEach(async () => {
    // Create fresh database instance
    db = new TestDB();
    await db.open();
  });

  afterEach(async () => {
    // Clean up
    await db.delete();
    await db.close();
  });

  describe('Version 3 Migration', () => {
    it('creates embeddings table with correct schema', async () => {
      const tableSchema = db.embeddings.schema;

      expect(tableSchema.name).toBe('embeddings');
      expect(tableSchema.primKey.name).toBe('key');
      expect(tableSchema.indexes).toBeDefined();

      // Check that version is indexed
      const versionIndex = tableSchema.indexes.find(idx => idx.name === 'version');
      expect(versionIndex).toBeDefined();
    });

    it('creates metadata table with correct schema', async () => {
      const tableSchema = db.metadata.schema;

      expect(tableSchema.name).toBe('metadata');
      expect(tableSchema.primKey.name).toBe('key');
    });

    it('preserves existing tables during migration', async () => {
      expect(db.tables.map(t => t.name)).toContain('messages');
      expect(db.tables.map(t => t.name)).toContain('channels');
      expect(db.tables.map(t => t.name)).toContain('searchIndex');
      expect(db.tables.map(t => t.name)).toContain('embeddings');
      expect(db.tables.map(t => t.name)).toContain('metadata');
    });

    it('has correct version number', () => {
      expect(db.verno).toBe(3);
    });
  });

  describe('Embeddings Table Operations', () => {
    it('stores and retrieves HNSW index data', async () => {
      const indexData: DBEmbedding = {
        key: 'hnsw_index',
        data: new ArrayBuffer(100),
        version: 1
      };

      await db.embeddings.put(indexData);
      const retrieved = await db.embeddings.get('hnsw_index');

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('hnsw_index');
      expect(retrieved?.version).toBe(1);
      // Check for ArrayBuffer-like properties (instanceof may fail across realms)
      expect(retrieved?.data).toBeDefined();
      expect(retrieved?.data.byteLength).toBe(100);
    });

    it('stores and retrieves index mapping data', async () => {
      const mappingData: DBEmbedding = {
        key: 'index_mapping',
        data: new ArrayBuffer(50),
        version: 1
      };

      await db.embeddings.put(mappingData);
      const retrieved = await db.embeddings.get('index_mapping');

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('index_mapping');
      expect(retrieved?.version).toBe(1);
      expect(retrieved?.data.byteLength).toBe(50);
    });

    it('updates embedding data when key exists', async () => {
      const initialData: DBEmbedding = {
        key: 'hnsw_index',
        data: new ArrayBuffer(100),
        version: 1
      };

      await db.embeddings.put(initialData);

      const updatedData: DBEmbedding = {
        key: 'hnsw_index',
        data: new ArrayBuffer(200),
        version: 2
      };

      await db.embeddings.put(updatedData);
      const retrieved = await db.embeddings.get('hnsw_index');

      expect(retrieved?.version).toBe(2);
      expect(retrieved?.data.byteLength).toBe(200);
    });

    it('queries embeddings by version', async () => {
      await db.embeddings.bulkPut([
        { key: 'index1', data: new ArrayBuffer(10), version: 1 },
        { key: 'index2', data: new ArrayBuffer(20), version: 2 },
        { key: 'index3', data: new ArrayBuffer(30), version: 2 },
        { key: 'index4', data: new ArrayBuffer(40), version: 3 }
      ]);

      const v2Embeddings = await db.embeddings.where('version').equals(2).toArray();

      expect(v2Embeddings).toHaveLength(2);
      expect(v2Embeddings.map(e => e.key)).toContain('index2');
      expect(v2Embeddings.map(e => e.key)).toContain('index3');
    });

    it('deletes embedding by key', async () => {
      await db.embeddings.put({
        key: 'temp_index',
        data: new ArrayBuffer(50),
        version: 1
      });

      await db.embeddings.delete('temp_index');
      const retrieved = await db.embeddings.get('temp_index');

      expect(retrieved).toBeUndefined();
    });

    it('counts total embeddings', async () => {
      await db.embeddings.bulkPut([
        { key: 'index1', data: new ArrayBuffer(10), version: 1 },
        { key: 'index2', data: new ArrayBuffer(20), version: 1 },
        { key: 'index3', data: new ArrayBuffer(30), version: 1 }
      ]);

      const count = await db.embeddings.count();
      expect(count).toBe(3);
    });

    it('handles large binary data', async () => {
      // Simulate a 10MB index file
      const largeBuffer = new ArrayBuffer(10 * 1024 * 1024);
      const view = new Uint8Array(largeBuffer);
      // Fill with some data
      for (let i = 0; i < 1000; i++) {
        view[i] = i % 256;
      }

      const largeData: DBEmbedding = {
        key: 'large_index',
        data: largeBuffer,
        version: 1
      };

      await db.embeddings.put(largeData);
      const retrieved = await db.embeddings.get('large_index');

      expect(retrieved).toBeDefined();
      expect(retrieved?.data.byteLength).toBe(10 * 1024 * 1024);

      // Verify some of the data
      const retrievedView = new Uint8Array(retrieved!.data);
      expect(retrievedView[0]).toBe(0);
      expect(retrievedView[100]).toBe(100);
    });

    it('clears all embeddings', async () => {
      await db.embeddings.bulkPut([
        { key: 'index1', data: new ArrayBuffer(10), version: 1 },
        { key: 'index2', data: new ArrayBuffer(20), version: 1 }
      ]);

      await db.embeddings.clear();
      const count = await db.embeddings.count();

      expect(count).toBe(0);
    });
  });

  describe('Metadata Table Operations', () => {
    it('stores and retrieves sync state', async () => {
      const syncState = {
        version: 1,
        lastSynced: Date.now(),
        indexLoaded: false
      };

      await db.metadata.put({
        key: 'embedding_sync_state',
        value: syncState
      });

      const retrieved = await db.metadata.get('embedding_sync_state');

      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toEqual(syncState);
    });

    it('stores and retrieves arbitrary metadata', async () => {
      const customMetadata = {
        feature_flags: {
          semantic_search: true,
          vector_sync: true
        },
        last_cleanup: Date.now()
      };

      await db.metadata.put({
        key: 'app_settings',
        value: customMetadata
      });

      const retrieved = await db.metadata.get('app_settings');

      expect(retrieved?.value).toEqual(customMetadata);
    });

    it('updates metadata when key exists', async () => {
      await db.metadata.put({
        key: 'counter',
        value: 1
      });

      await db.metadata.put({
        key: 'counter',
        value: 2
      });

      const retrieved = await db.metadata.get('counter');
      expect(retrieved?.value).toBe(2);
    });

    it('returns undefined for non-existent key', async () => {
      const retrieved = await db.metadata.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('deletes metadata by key', async () => {
      await db.metadata.put({
        key: 'temp_setting',
        value: 'test'
      });

      await db.metadata.delete('temp_setting');
      const retrieved = await db.metadata.get('temp_setting');

      expect(retrieved).toBeUndefined();
    });

    it('stores complex nested objects', async () => {
      const complexData = {
        user_preferences: {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            push: false,
            desktop: true
          }
        },
        search_history: ['query1', 'query2', 'query3'],
        timestamps: {
          created: Date.now(),
          modified: Date.now()
        }
      };

      await db.metadata.put({
        key: 'user_data',
        value: complexData
      });

      const retrieved = await db.metadata.get('user_data');
      expect(retrieved?.value).toEqual(complexData);
    });

    it('stores arrays as metadata values', async () => {
      const arrayValue = [1, 2, 3, 4, 5];

      await db.metadata.put({
        key: 'numbers',
        value: arrayValue
      });

      const retrieved = await db.metadata.get('numbers');
      expect(retrieved?.value).toEqual(arrayValue);
    });

    it('lists all metadata keys', async () => {
      await db.metadata.bulkPut([
        { key: 'setting1', value: 'value1' },
        { key: 'setting2', value: 'value2' },
        { key: 'setting3', value: 'value3' }
      ]);

      const allKeys = await db.metadata.toCollection().primaryKeys();

      expect(allKeys).toHaveLength(3);
      expect(allKeys).toContain('setting1');
      expect(allKeys).toContain('setting2');
      expect(allKeys).toContain('setting3');
    });

    it('clears all metadata', async () => {
      await db.metadata.bulkPut([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' }
      ]);

      await db.metadata.clear();
      const count = await db.metadata.count();

      expect(count).toBe(0);
    });
  });

  describe('Combined Embeddings and Metadata Operations', () => {
    it('coordinates embedding sync with metadata state', async () => {
      // Simulate a complete sync operation
      const indexData = new ArrayBuffer(100);
      const mappingData = new ArrayBuffer(50);
      const version = 1;

      // Store embeddings
      await db.embeddings.bulkPut([
        { key: 'hnsw_index', data: indexData, version },
        { key: 'index_mapping', data: mappingData, version }
      ]);

      // Update sync state
      await db.metadata.put({
        key: 'embedding_sync_state',
        value: {
          version,
          lastSynced: Date.now(),
          indexLoaded: false
        }
      });

      // Verify both tables
      const embeddingsCount = await db.embeddings.where('version').equals(version).count();
      const syncState = await db.metadata.get('embedding_sync_state');

      expect(embeddingsCount).toBe(2);
      expect((syncState?.value as any).version).toBe(version);
    });

    it('handles version upgrade scenario', async () => {
      // Initial version
      await db.embeddings.put({
        key: 'hnsw_index',
        data: new ArrayBuffer(100),
        version: 1
      });

      await db.metadata.put({
        key: 'embedding_sync_state',
        value: { version: 1, lastSynced: Date.now(), indexLoaded: true }
      });

      // Upgrade to version 2
      await db.embeddings.put({
        key: 'hnsw_index',
        data: new ArrayBuffer(200),
        version: 2
      });

      await db.metadata.put({
        key: 'embedding_sync_state',
        value: { version: 2, lastSynced: Date.now(), indexLoaded: false }
      });

      // Verify upgrade
      const embedding = await db.embeddings.get('hnsw_index');
      const state = await db.metadata.get('embedding_sync_state');

      expect(embedding?.version).toBe(2);
      expect((state?.value as any).version).toBe(2);
    });

    it('maintains data isolation between tables', async () => {
      // Add data to both tables with same key name
      await db.embeddings.put({
        key: 'shared_key',
        data: new ArrayBuffer(50),
        version: 1
      });

      await db.metadata.put({
        key: 'shared_key',
        value: { some: 'metadata' }
      });

      const embedding = await db.embeddings.get('shared_key');
      const metadata = await db.metadata.get('shared_key');

      expect(embedding).toBeDefined();
      expect(metadata).toBeDefined();
      // Check for ArrayBuffer-like properties (instanceof may fail across realms)
      expect(embedding?.data).toBeDefined();
      expect(embedding?.data.byteLength).toBe(50);
      expect(metadata?.value).toEqual({ some: 'metadata' });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles null and undefined values in metadata', async () => {
      await db.metadata.put({ key: 'null_value', value: null });
      await db.metadata.put({ key: 'undefined_value', value: undefined });

      const nullResult = await db.metadata.get('null_value');
      const undefinedResult = await db.metadata.get('undefined_value');

      expect(nullResult?.value).toBeNull();
      expect(undefinedResult?.value).toBeUndefined();
    });

    it('handles empty ArrayBuffer in embeddings', async () => {
      await db.embeddings.put({
        key: 'empty_buffer',
        data: new ArrayBuffer(0),
        version: 1
      });

      const result = await db.embeddings.get('empty_buffer');

      expect(result?.data.byteLength).toBe(0);
    });

    it('handles concurrent writes to same embedding key', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        db.embeddings.put({
          key: 'concurrent_test',
          data: new ArrayBuffer(i * 10),
          version: i
        })
      );

      await Promise.all(writes);

      const result = await db.embeddings.get('concurrent_test');
      // One of the writes should have succeeded
      expect(result).toBeDefined();
      expect(result?.version).toBeGreaterThanOrEqual(0);
      expect(result?.version).toBeLessThan(10);
    });

    it('handles transaction rollback', async () => {
      try {
        await db.transaction('rw', db.embeddings, db.metadata, async () => {
          await db.embeddings.put({
            key: 'test',
            data: new ArrayBuffer(10),
            version: 1
          });

          await db.metadata.put({
            key: 'test',
            value: 'test'
          });

          // Force rollback
          throw new Error('Intentional rollback');
        });
      } catch (error) {
        // Expected
      }

      const embedding = await db.embeddings.get('test');
      const metadata = await db.metadata.get('test');

      // Both should be undefined due to rollback
      expect(embedding).toBeUndefined();
      expect(metadata).toBeUndefined();
    });
  });
});
