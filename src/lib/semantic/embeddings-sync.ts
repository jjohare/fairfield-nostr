/**
 * Embedding Sync Service
 * Lazy-loads vector embeddings from R2 over WiFi only
 */

import { db } from '$lib/db';

// Google Cloud Storage public URL (configured via environment)
// Embeddings stored in public GCS bucket: minimoonoir-vectors
const GCS_BASE_URL = import.meta.env.VITE_GCS_EMBEDDINGS_URL || 'https://storage.googleapis.com/minimoonoir-vectors';

export interface EmbeddingManifest {
  version: number;
  updated_at: string;
  total_vectors: number;
  dimensions: number;
  model: string;
  quantize_type: 'int8' | 'float32';
  index_size_bytes: number;
  embeddings_size_bytes: number;
  latest: {
    index: string;
    index_mapping: string;
    embeddings: string;
    manifest: string;
  };
}

interface SyncState {
  version: number;
  lastSynced: number;
  indexLoaded: boolean;
}

/**
 * Check if we should sync embeddings
 * Only sync on WiFi or unmetered connections
 */
export function shouldSync(): boolean {
  if (typeof navigator === 'undefined') return false;

  const connection = (navigator as any).connection;
  if (!connection) {
    // Can't detect connection type, allow sync
    return true;
  }

  // Check for WiFi or ethernet
  const type = connection.type;
  if (type === 'wifi' || type === 'ethernet') {
    return true;
  }

  // Check effective type for fast connections
  const effectiveType = connection.effectiveType;
  if (effectiveType === '4g' && !connection.saveData) {
    return true;
  }

  // Check if not metered
  if (connection.metered === false) {
    return true;
  }

  return false;
}

/**
 * Fetch the current manifest from Google Cloud Storage
 */
export async function fetchManifest(): Promise<EmbeddingManifest | null> {
  try {
    const response = await fetch(`${GCS_BASE_URL}/latest/manifest.json`, {
      cache: 'no-cache'
    });

    if (!response.ok) {
      console.warn('Failed to fetch embedding manifest:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Error fetching embedding manifest:', error);
    return null;
  }
}

/**
 * Get local sync state from IndexedDB
 */
export async function getLocalSyncState(): Promise<SyncState | null> {
  try {
    const state = await db.table('metadata').get('embedding_sync_state');
    return state?.value as SyncState | null;
  } catch {
    return null;
  }
}

/**
 * Save local sync state
 */
async function saveSyncState(state: SyncState): Promise<void> {
  await db.table('metadata').put({
    key: 'embedding_sync_state',
    value: state
  });
}

/**
 * Download and store index files
 */
async function downloadIndex(manifest: EmbeddingManifest): Promise<boolean> {
  try {
    console.log(`Downloading HNSW index (${(manifest.index_size_bytes / 1024 / 1024).toFixed(1)} MB)...`);

    // Download index.bin
    const indexResponse = await fetch(`${GCS_BASE_URL}/${manifest.latest.index}`);
    if (!indexResponse.ok) throw new Error('Failed to download index');
    const indexBuffer = await indexResponse.arrayBuffer();

    // Download mapping
    const mappingResponse = await fetch(`${GCS_BASE_URL}/${manifest.latest.index_mapping}`);
    if (!mappingResponse.ok) throw new Error('Failed to download mapping');
    const mappingBuffer = await mappingResponse.arrayBuffer();

    // Store in IndexedDB
    await db.table('embeddings').put({
      key: 'hnsw_index',
      data: indexBuffer,
      version: manifest.version
    });

    await db.table('embeddings').put({
      key: 'index_mapping',
      data: mappingBuffer,
      version: manifest.version
    });

    console.log('Index downloaded and stored');
    return true;
  } catch (error) {
    console.error('Error downloading index:', error);
    return false;
  }
}

/**
 * Main sync function - checks and downloads new embeddings
 */
export async function syncEmbeddings(force = false): Promise<{ synced: boolean; version: number }> {
  // Check if we should sync
  if (!force && !shouldSync()) {
    console.log('Skipping embedding sync (not on WiFi)');
    return { synced: false, version: 0 };
  }

  // Get current local state
  const localState = await getLocalSyncState();
  const localVersion = localState?.version || 0;

  // Fetch remote manifest
  const manifest = await fetchManifest();
  if (!manifest) {
    return { synced: false, version: localVersion };
  }

  // Check if we need to update
  if (!force && manifest.version <= localVersion) {
    console.log(`Embeddings up to date (v${localVersion})`);
    return { synced: false, version: localVersion };
  }

  console.log(`Updating embeddings: v${localVersion} -> v${manifest.version}`);

  // Download new index
  const success = await downloadIndex(manifest);

  if (success) {
    // Update local state
    await saveSyncState({
      version: manifest.version,
      lastSynced: Date.now(),
      indexLoaded: false // Will be set when actually loaded into memory
    });

    return { synced: true, version: manifest.version };
  }

  return { synced: false, version: localVersion };
}

/**
 * Initialize sync on app start
 */
export async function initEmbeddingSync(): Promise<void> {
  // Don't block app startup - sync in background
  setTimeout(async () => {
    try {
      const result = await syncEmbeddings();
      if (result.synced) {
        console.log(`Embeddings synced to v${result.version}`);
      }
    } catch (error) {
      console.warn('Background embedding sync failed:', error);
    }
  }, 5000); // Wait 5s after app start
}
