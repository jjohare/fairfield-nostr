import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadIndex,
  searchSimilar,
  isSearchAvailable,
  getSearchStats,
  unloadIndex,
  resetHnswState
} from '$lib/semantic/hnsw-search';
import { db } from '$lib/db';

// Mock the database
vi.mock('$lib/db', () => ({
  db: {
    table: vi.fn(() => ({
      get: vi.fn()
    }))
  }
}));

// Use vi.hoisted to ensure mocks are available when vi.mock runs
const { mockSearchKnn, mockSetEf, mockAddPoint, mockHnswIndex, mockHierarchicalNSW, mockLoadHnswlib } = vi.hoisted(() => {
  const mockSearchKnn = vi.fn();
  const mockSetEf = vi.fn();
  const mockAddPoint = vi.fn();
  const mockHnswIndex = {
    searchKnn: mockSearchKnn,
    setEf: mockSetEf,
    addPoint: mockAddPoint
  };

  const mockHierarchicalNSW = vi.fn().mockReturnValue(mockHnswIndex);
  const mockLoadHnswlib = vi.fn().mockResolvedValue({
    HierarchicalNSW: mockHierarchicalNSW
  });

  return { mockSearchKnn, mockSetEf, mockAddPoint, mockHnswIndex, mockHierarchicalNSW, mockLoadHnswlib };
});

vi.mock('hnswlib-wasm', () => ({
  loadHnswlib: () => mockLoadHnswlib()
}));

describe('HNSW Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all module state before each test (including hnswLib cache)
    resetHnswState();
    // Reset URL mock
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    // Re-setup mock implementations after clearAllMocks
    mockHierarchicalNSW.mockReturnValue(mockHnswIndex);
    mockLoadHnswlib.mockResolvedValue({
      HierarchicalNSW: mockHierarchicalNSW
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadIndex', () => {
    it('loads index from IndexedDB successfully', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mappingBuffer = new TextEncoder().encode(
        JSON.stringify({
          labels: [0, 1, 2],
          ids: ['note1', 'note2', 'note3']
        })
      ).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(true);
      expect(mockTable).toHaveBeenCalledWith('embeddings');
      expect(mockGet).toHaveBeenCalledWith('hnsw_index');
      expect(mockGet).toHaveBeenCalledWith('index_mapping');
      expect(mockLoadHnswlib).toHaveBeenCalled();
      expect(mockHierarchicalNSW).toHaveBeenCalledWith('cosine', 384);
      expect(mockSetEf).toHaveBeenCalledWith(50);
      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 3 vectors');

      consoleLogSpy.mockRestore();
    });

    it('returns false when no index data in IndexedDB', async () => {
      const mockGet = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('No index data in IndexedDB');
      expect(mockLoadHnswlib).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('returns false when index data is missing', async () => {
      const mappingBuffer = new ArrayBuffer(50);

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('No index data in IndexedDB');

      consoleLogSpy.mockRestore();
    });

    it('returns false when mapping data is missing', async () => {
      const indexBuffer = new ArrayBuffer(100);

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce(undefined);

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('No index data in IndexedDB');

      consoleLogSpy.mockRestore();
    });

    it('handles hnswlib loading failure', async () => {
      mockLoadHnswlib.mockRejectedValueOnce(new Error('Failed to load WASM'));

      const indexBuffer = new ArrayBuffer(100);
      const mappingBuffer = new ArrayBuffer(50);

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load HNSW index:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      // Reset for other tests
      mockLoadHnswlib.mockResolvedValue({
        HierarchicalNSW: mockHierarchicalNSW
      });
    });

    it('parses NPZ mapping with valid JSON', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1, 2, 3, 4],
        ids: ['note1', 'note2', 'note3', 'note4', 'note5']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadIndex();

      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 5 vectors');

      consoleLogSpy.mockRestore();
    });

    it('handles invalid JSON in mapping gracefully', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mappingBuffer = new TextEncoder().encode('invalid json').buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to parse mapping, using index as ID'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 0 vectors');

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('handles mapping with mismatched array lengths', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1, 2],
        ids: ['note1', 'note2'] // Shorter than labels
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(true);
      // Should only map 2 items (length of shortest array)
      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 2 vectors');

      consoleLogSpy.mockRestore();
    });

    it('handles empty mapping arrays', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [],
        ids: []
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadIndex();

      expect(result).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 0 vectors');

      consoleLogSpy.mockRestore();
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      // Setup a loaded index for search tests
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1, 2, 3, 4],
        ids: ['note1', 'note2', 'note3', 'note4', 'note5']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      await loadIndex();
    });

    it('searches and returns results above minimum score', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0, 1, 2],
        distances: [0.1, 0.3, 0.4] // Cosine distances (lower is better)
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query', 3, 0.5);

      expect(results).toHaveLength(3);
      expect(results[0].noteId).toBe('note1');
      expect(results[0].score).toBeCloseTo(0.9); // 1 - 0.1
      expect(results[1].noteId).toBe('note2');
      expect(results[1].score).toBeCloseTo(0.7); // 1 - 0.3
      expect(results[2].noteId).toBe('note3');
      expect(results[2].score).toBeCloseTo(0.6); // 1 - 0.4

      // Results should be sorted by score descending
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);

      consoleWarnSpy.mockRestore();
    });

    it('filters results below minimum score', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0, 1, 2, 3],
        distances: [0.1, 0.3, 0.6, 0.8] // 0.6 and 0.8 -> scores 0.4 and 0.2
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query', 4, 0.5);

      // Only first 2 results have score >= 0.5
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThanOrEqual(0.5);
      expect(results[1].score).toBeGreaterThanOrEqual(0.5);

      consoleWarnSpy.mockRestore();
    });

    it('returns empty array when no results meet minimum score', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0, 1],
        distances: [0.9, 0.95] // Scores: 0.1, 0.05
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query', 2, 0.5);

      expect(results).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });

    it('handles unmapped labels by using label as ID', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0, 99], // 99 is not in mapping
        distances: [0.1, 0.2]
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query', 2, 0.5);

      expect(results).toHaveLength(2);
      expect(results[0].noteId).toBe('note1');
      expect(results[1].noteId).toBe('99'); // Fallback to string label

      consoleWarnSpy.mockRestore();
    });

    it('loads index automatically if not loaded', async () => {
      unloadIndex();

      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1],
        ids: ['note1', 'note2']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      mockSearchKnn.mockReturnValue({
        neighbors: [0],
        distances: [0.1]
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const results = await searchSimilar('test query');

      expect(results).toHaveLength(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('Index loaded with 2 vectors');

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('throws error when index cannot be loaded', async () => {
      unloadIndex();

      const mockGet = vi.fn().mockResolvedValue(undefined);
      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      await expect(searchSimilar('test query')).rejects.toThrow(
        'HNSW index not available'
      );
    });

    it('uses default parameters when not specified', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0, 1],
        distances: [0.1, 0.2]
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query');

      expect(mockSearchKnn).toHaveBeenCalledWith(
        expect.any(Array),
        10 // Default k
      );
      expect(results).toHaveLength(2);

      consoleWarnSpy.mockRestore();
    });

    it('returns results with correct structure', async () => {
      mockSearchKnn.mockReturnValue({
        neighbors: [0],
        distances: [0.2]
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await searchSimilar('test query', 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('noteId');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('distance');
      expect(results[0].distance).toBe(0.2);
      expect(results[0].score).toBeCloseTo(0.8);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('isSearchAvailable', () => {
    it('returns false when index is not loaded', () => {
      unloadIndex();
      expect(isSearchAvailable()).toBe(false);
    });

    it('returns true when index is loaded', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1],
        ids: ['note1', 'note2']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      await loadIndex();
      expect(isSearchAvailable()).toBe(true);
    });
  });

  describe('getSearchStats', () => {
    it('returns null when index is not loaded', () => {
      unloadIndex();
      expect(getSearchStats()).toBeNull();
    });

    it('returns correct stats when index is loaded', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1, 2],
        ids: ['note1', 'note2', 'note3']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadIndex();

      const stats = getSearchStats();

      expect(stats).toEqual({
        vectorCount: 3,
        dimensions: 384
      });

      consoleLogSpy.mockRestore();
    });
  });

  describe('unloadIndex', () => {
    it('clears index and mapping from memory', async () => {
      const indexBuffer = new ArrayBuffer(100);
      const mapping = {
        labels: [0, 1],
        ids: ['note1', 'note2']
      };
      const mappingBuffer = new TextEncoder().encode(JSON.stringify(mapping)).buffer;

      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({ data: indexBuffer, version: 1 })
        .mockResolvedValueOnce({ data: mappingBuffer, version: 1 });

      const mockTable = vi.fn().mockReturnValue({ get: mockGet });
      (db.table as any) = mockTable;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadIndex();
      expect(isSearchAvailable()).toBe(true);

      unloadIndex();
      expect(isSearchAvailable()).toBe(false);
      expect(getSearchStats()).toBeNull();

      consoleLogSpy.mockRestore();
    });

    it('can be called multiple times safely', () => {
      unloadIndex();
      unloadIndex();
      unloadIndex();

      expect(isSearchAvailable()).toBe(false);
    });
  });
});
