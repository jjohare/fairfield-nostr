import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldSync,
  fetchManifest,
  getLocalSyncState,
  syncEmbeddings,
  initEmbeddingSync,
  type EmbeddingManifest
} from '$lib/semantic/embeddings-sync';
import { db } from '$lib/db';

// Mock the database
vi.mock('$lib/db', () => ({
  db: {
    table: vi.fn(() => ({
      get: vi.fn(),
      put: vi.fn()
    }))
  }
}));

describe('Embeddings Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('shouldSync', () => {
    it('returns false when navigator is undefined', () => {
      const originalNavigator = global.navigator;
      // @ts-ignore - Testing undefined navigator
      global.navigator = undefined;

      expect(shouldSync()).toBe(false);

      global.navigator = originalNavigator;
    });

    it('returns true when connection API is not available', () => {
      const result = shouldSync();
      expect(result).toBe(true);
    });

    it('returns true for WiFi connection', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'wifi' },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(true);
    });

    it('returns true for ethernet connection', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'ethernet' },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(true);
    });

    it('returns true for 4g with saveData disabled', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          type: 'cellular',
          effectiveType: '4g',
          saveData: false
        },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(true);
    });

    it('returns false for 4g with saveData enabled', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          type: 'cellular',
          effectiveType: '4g',
          saveData: true
        },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(false);
    });

    it('returns true for unmetered connection', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          type: 'cellular',
          metered: false
        },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(true);
    });

    it('returns false for metered connection', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          type: 'cellular',
          effectiveType: '3g',
          metered: true
        },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(false);
    });

    it('returns false for 3g connection', () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          type: 'cellular',
          effectiveType: '3g'
        },
        writable: true,
        configurable: true
      });

      expect(shouldSync()).toBe(false);
    });
  });

  describe('fetchManifest', () => {
    const mockManifest: EmbeddingManifest = {
      version: 1,
      updated_at: '2025-12-14T00:00:00Z',
      total_vectors: 1000,
      dimensions: 384,
      model: 'all-minilm-l6-v2',
      quantize_type: 'int8',
      index_size_bytes: 1024000,
      embeddings_size_bytes: 2048000,
      latest: {
        index: 'latest/index.bin',
        index_mapping: 'latest/mapping.npz',
        embeddings: 'latest/embeddings.npz',
        manifest: 'latest/manifest.json'
      }
    };

    it('fetches manifest successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest
      });

      const result = await fetchManifest();

      expect(result).toEqual(mockManifest);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/latest/manifest.json'),
        { cache: 'no-cache' }
      );
    });

    it('returns null when response is not ok', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await fetchManifest();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch embedding manifest:',
        404
      );

      consoleWarnSpy.mockRestore();
    });

    it('returns null when fetch throws error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await fetchManifest();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error fetching embedding manifest:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('handles JSON parsing errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await fetchManifest();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getLocalSyncState', () => {
    it('returns sync state from IndexedDB', async () => {
      const mockState = {
        version: 1,
        lastSynced: Date.now(),
        indexLoaded: true
      };

      const mockGet = vi.fn().mockResolvedValue({ value: mockState });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const result = await getLocalSyncState();

      expect(result).toEqual(mockState);
      expect(mockTable).toHaveBeenCalledWith('metadata');
      expect(mockGet).toHaveBeenCalledWith('embedding_sync_state');
    });

    it('returns null when no state exists', async () => {
      const mockGet = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const result = await getLocalSyncState();

      expect(result).toBeNull();
    });

    it('returns null when database query fails', async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error('DB error'));
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const result = await getLocalSyncState();

      expect(result).toBeNull();
    });
  });

  describe('syncEmbeddings', () => {
    const mockManifest: EmbeddingManifest = {
      version: 2,
      updated_at: '2025-12-14T00:00:00Z',
      total_vectors: 1000,
      dimensions: 384,
      model: 'all-minilm-l6-v2',
      quantize_type: 'int8',
      index_size_bytes: 1024000,
      embeddings_size_bytes: 2048000,
      latest: {
        index: 'latest/index.bin',
        index_mapping: 'latest/mapping.npz',
        embeddings: 'latest/embeddings.npz',
        manifest: 'latest/manifest.json'
      }
    };

    beforeEach(() => {
      // Mock connection to allow sync
      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'wifi' },
        writable: true,
        configurable: true
      });
    });

    it('skips sync when not on WiFi and not forced', async () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'cellular', effectiveType: '3g', metered: true },
        writable: true,
        configurable: true
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await syncEmbeddings(false);

      expect(result).toEqual({ synced: false, version: 0 });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Skipping embedding sync (not on WiFi)'
      );

      consoleLogSpy.mockRestore();
    });

    it('syncs when forced regardless of connection', async () => {
      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'cellular', effectiveType: '3g', metered: true },
        writable: true,
        configurable: true
      });

      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockPut = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet, put: mockPut });
      (db.table as any) = mockTable;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(100)
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(50)
        });

      const result = await syncEmbeddings(true);

      expect(result.synced).toBe(true);
      expect(result.version).toBe(2);
    });

    it('returns false when manifest fetch fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await syncEmbeddings();

      expect(result).toEqual({ synced: false, version: 1 });

      consoleWarnSpy.mockRestore();
    });

    it('skips sync when local version is up to date', async () => {
      const mockGet = vi.fn().mockResolvedValue({ value: { version: 2 } });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await syncEmbeddings();

      expect(result).toEqual({ synced: false, version: 2 });
      expect(consoleLogSpy).toHaveBeenCalledWith('Embeddings up to date (v2)');

      consoleLogSpy.mockRestore();
    });

    it('downloads and stores new index successfully', async () => {
      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockPut = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet, put: mockPut });
      (db.table as any) = mockTable;

      const indexBuffer = new ArrayBuffer(100);
      const mappingBuffer = new ArrayBuffer(50);

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => indexBuffer
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mappingBuffer
        });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await syncEmbeddings();

      expect(result.synced).toBe(true);
      expect(result.version).toBe(2);

      // Verify index was stored
      expect(mockPut).toHaveBeenCalledWith({
        key: 'hnsw_index',
        data: indexBuffer,
        version: 2
      });

      // Verify mapping was stored
      expect(mockPut).toHaveBeenCalledWith({
        key: 'index_mapping',
        data: mappingBuffer,
        version: 2
      });

      // Verify sync state was updated
      expect(mockPut).toHaveBeenCalledWith({
        key: 'embedding_sync_state',
        value: expect.objectContaining({
          version: 2,
          indexLoaded: false
        })
      });

      consoleLogSpy.mockRestore();
    });

    it('handles index download failure', async () => {
      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await syncEmbeddings();

      expect(result).toEqual({ synced: false, version: 1 });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('handles mapping download failure', async () => {
      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(100)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await syncEmbeddings();

      expect(result).toEqual({ synced: false, version: 1 });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('handles zero local version', async () => {
      const mockGet = vi.fn().mockResolvedValue(null);
      const mockPut = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet, put: mockPut });
      (db.table as any) = mockTable;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(100)
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(50)
        });

      const result = await syncEmbeddings();

      expect(result.synced).toBe(true);
      expect(result.version).toBe(2);
    });
  });

  describe('initEmbeddingSync', () => {
    it('schedules background sync', async () => {
      vi.useFakeTimers();

      const mockGet = vi.fn().mockResolvedValue({ value: { version: 1 } });
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      Object.defineProperty(global.navigator, 'connection', {
        value: { type: 'wifi' },
        writable: true,
        configurable: true
      });

      const mockManifest: EmbeddingManifest = {
        version: 1,
        updated_at: '2025-12-14T00:00:00Z',
        total_vectors: 1000,
        dimensions: 384,
        model: 'all-minilm-l6-v2',
        quantize_type: 'int8',
        index_size_bytes: 1024000,
        embeddings_size_bytes: 2048000,
        latest: {
          index: 'latest/index.bin',
          index_mapping: 'latest/mapping.npz',
          embeddings: 'latest/embeddings.npz',
          manifest: 'latest/manifest.json'
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockManifest
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start initialization (doesn't block)
      const promise = initEmbeddingSync();

      // Should return immediately
      await promise;

      // Advance timers to trigger background sync
      await vi.advanceTimersByTimeAsync(5000);

      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      vi.useRealTimers();
    });

    it('handles background sync errors gracefully', async () => {
      vi.useFakeTimers();

      // Mock db to return null (no local state)
      const mockGet = vi.fn().mockResolvedValue(null);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      // Mock fetch to throw - this simulates a network error during manifest fetch
      // getLocalSyncState catches DB errors, so we need fetchManifest to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initEmbeddingSync();
      await vi.advanceTimersByTimeAsync(5000);

      // The error is caught and logged by fetchManifest
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error fetching embedding manifest:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
