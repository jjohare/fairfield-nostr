/**
 * Search index initialization
 * Call this from the app's root layout to ensure search index is ready
 */

import { initializeSearchIndex } from '$lib/utils/buildSearchIndex';
import { browser } from '$app/environment';

let initialized = false;

/**
 * Initialize search index on app startup
 * Only runs once in browser environment
 */
export async function initSearch(): Promise<void> {
  if (!browser || initialized) {
    return;
  }

  try {
    initialized = true;
    await initializeSearchIndex();
  } catch (error) {
    console.error('Failed to initialize search index:', error);
    // Don't throw - app should still work without search
    initialized = false;
  }
}

/**
 * Reset initialization state (for testing)
 */
export function resetSearchInit(): void {
  initialized = false;
}
