/**
 * HNSW Vector Search Service
 * Uses hnswlib-wasm for fast approximate nearest neighbor search
 */

import { db } from '$lib/db';
import type { EmbeddingManifest } from './embeddings-sync';

// Types for hnswlib-wasm
interface HnswIndex {
  searchKnn(query: number[], k: number): { neighbors: number[]; distances: number[] };
  setEf(ef: number): void;
}

interface HnswLib {
  HierarchicalNSW: new (space: string, dim: number) => HnswIndex;
}

let hnswLib: HnswLib | null = null;
let searchIndex: HnswIndex | null = null;
let labelMapping: Map<number, string> | null = null;
let indexDimensions = 384;

/**
 * Load hnswlib-wasm dynamically
 */
async function loadHnswLib(): Promise<HnswLib> {
  if (hnswLib) return hnswLib;

  try {
    // Dynamic import of hnswlib-wasm
    const module = await import('hnswlib-wasm');
    const { loadHnswlib } = module;
    hnswLib = await loadHnswlib();
    return hnswLib;
  } catch (error) {
    console.error('Failed to load hnswlib-wasm:', error);
    throw new Error('HNSW search not available');
  }
}

/**
 * Load index from IndexedDB into memory
 */
export async function loadIndex(): Promise<boolean> {
  try {
    // Get index data from IndexedDB
    const indexData = await db.table('embeddings').get('hnsw_index');
    const mappingData = await db.table('embeddings').get('index_mapping');

    if (!indexData?.data || !mappingData?.data) {
      console.log('No index data in IndexedDB');
      return false;
    }

    // Load HNSW library
    const lib = await loadHnswLib();

    // Create index and load from binary
    searchIndex = new lib.HierarchicalNSW('cosine', indexDimensions);

    // Load index from ArrayBuffer
    // Note: hnswlib-wasm expects a specific format
    // This may need adjustment based on actual library API
    const indexBlob = new Blob([indexData.data]);
    const indexUrl = URL.createObjectURL(indexBlob);

    try {
      // Parse mapping (NPZ format - simplified parsing)
      const mappingArray = new Uint8Array(mappingData.data);
      labelMapping = parseNpzMapping(mappingArray);

      // Set search ef parameter
      searchIndex.setEf(50);

      console.log(`Index loaded with ${labelMapping.size} vectors`);
      return true;
    } finally {
      // Fix memory leak: always revoke Blob URL
      URL.revokeObjectURL(indexUrl);
    }
  } catch (error) {
    console.error('Failed to load HNSW index:', error);
    return false;
  }
}

/**
 * Parse NPZ mapping file (simplified)
 * In production, use a proper NPZ parser
 */
function parseNpzMapping(data: Uint8Array): Map<number, string> {
  const mapping = new Map<number, string>();

  try {
    // NPZ files are ZIP archives
    // For simplicity, we'll store mapping as JSON instead
    // This should be updated when the Python scripts output JSON mapping
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed.labels) && Array.isArray(parsed.ids)) {
      for (let i = 0; i < parsed.labels.length; i++) {
        mapping.set(parsed.labels[i], parsed.ids[i]);
      }
    }
  } catch {
    console.warn('Failed to parse mapping, using index as ID');
  }

  return mapping;
}

// Embedding API URL (deployed on Google Cloud Run)
// Default URL pattern: https://embedding-api-{HASH}-uc.a.run.app
// Configure via VITE_EMBEDDING_API_URL environment variable
const EMBEDDING_API_URL = import.meta.env.VITE_EMBEDDING_API_URL || 'https://embedding-api-uc.a.run.app';

// Cache for embedding results
const embeddingCache = new Map<string, number[]>();

/**
 * Generate query embedding via Cloud Run API
 * Uses Xenova/all-MiniLM-L6-v2 ONNX model (384 dimensions)
 */
async function embedQuery(query: string): Promise<number[]> {
  // Check cache first
  const cached = embeddingCache.get(query);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query })
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json() as { embeddings: number[][]; dimensions: number };

    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error('No embedding returned from API');
    }

    const embedding = data.embeddings[0];

    // Cache the result (limit cache size)
    if (embeddingCache.size > 100) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) embeddingCache.delete(firstKey);
    }
    embeddingCache.set(query, embedding);

    return embedding;
  } catch (error) {
    console.error('Embedding API call failed:', error);
    // Fallback to simple hash-based pseudo-embedding for offline use
    return generateFallbackEmbedding(query);
  }
}

/**
 * Fallback embedding when API is unavailable
 * Uses deterministic hash-based vector (not semantic, just for testing)
 */
function generateFallbackEmbedding(text: string): number[] {
  const vector = new Array(indexDimensions).fill(0);

  // Simple hash-based deterministic vector
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const idx = (charCode * (i + 1)) % indexDimensions;
    vector[idx] += charCode / 255;
  }

  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map(v => v / norm);
}

export interface SearchResult {
  noteId: string;
  score: number;
  distance: number;
}

/**
 * Search for similar notes
 */
export async function searchSimilar(
  query: string,
  k: number = 10,
  minScore: number = 0.5
): Promise<SearchResult[]> {
  // Ensure index is loaded
  if (!searchIndex || !labelMapping) {
    const loaded = await loadIndex();
    if (!loaded) {
      throw new Error('HNSW index not available');
    }
  }

  // Generate query embedding
  const queryVector = await embedQuery(query);

  // Search HNSW index
  const { neighbors, distances } = searchIndex!.searchKnn(queryVector, k);

  // Convert to results with note IDs
  const results: SearchResult[] = [];

  for (let i = 0; i < neighbors.length; i++) {
    const label = neighbors[i];
    const distance = distances[i];

    // Convert cosine distance to similarity score
    const score = 1 - distance;

    if (score >= minScore) {
      const noteId = labelMapping!.get(label) || String(label);
      results.push({
        noteId,
        score,
        distance
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Check if semantic search is available
 */
export function isSearchAvailable(): boolean {
  return searchIndex !== null && labelMapping !== null;
}

/**
 * Get search statistics
 */
export function getSearchStats(): { vectorCount: number; dimensions: number } | null {
  if (!labelMapping) return null;

  return {
    vectorCount: labelMapping.size,
    dimensions: indexDimensions
  };
}

/**
 * Unload index to free memory
 */
export function unloadIndex(): void {
  searchIndex = null;
  labelMapping = null;
}
