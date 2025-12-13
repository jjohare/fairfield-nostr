/**
 * Build search index from existing messages
 * This is a utility script to rebuild the search index for all cached messages
 */

import { buildSearchIndex, getIndexStats } from './searchIndex';
import { db } from '$lib/db';

/**
 * Rebuild the entire search index
 * This should be called:
 * 1. On first app load (if index is empty)
 * 2. When user explicitly requests rebuild
 * 3. After database migrations
 */
export async function rebuildSearchIndex(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  console.log('Starting search index rebuild...');

  const startTime = performance.now();

  try {
    await buildSearchIndex(onProgress);

    const stats = await getIndexStats();
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`Search index rebuild complete!`);
    console.log(`- Indexed: ${stats.totalIndexed} messages`);
    console.log(`- Duration: ${duration.toFixed(2)}s`);
    console.log(`- Average: ${(stats.totalIndexed / duration).toFixed(0)} messages/sec`);

    return;
  } catch (error) {
    console.error('Search index rebuild failed:', error);
    throw error;
  }
}

/**
 * Check if search index needs to be built
 * Returns true if index is empty or significantly out of date
 */
export async function needsIndexRebuild(): Promise<boolean> {
  const stats = await getIndexStats();
  const messageCount = await db.messages.where('deleted').equals(0).count();

  // Index is empty
  if (stats.totalIndexed === 0 && messageCount > 0) {
    return true;
  }

  // Index has significantly fewer entries than messages (more than 10% difference)
  const difference = messageCount - stats.totalIndexed;
  const percentDifference = (difference / messageCount) * 100;

  if (percentDifference > 10) {
    console.log(`Search index out of sync: ${difference} messages not indexed (${percentDifference.toFixed(1)}%)`);
    return true;
  }

  return false;
}

/**
 * Auto-initialize search index on app startup
 * Call this from app initialization code
 */
export async function initializeSearchIndex(): Promise<void> {
  const needsRebuild = await needsIndexRebuild();

  if (needsRebuild) {
    console.log('Search index is empty or out of date, rebuilding...');
    await rebuildSearchIndex((current, total) => {
      if (current % 100 === 0 || current === total) {
        console.log(`Indexing messages: ${current}/${total} (${((current/total)*100).toFixed(1)}%)`);
      }
    });
  } else {
    const stats = await getIndexStats();
    console.log(`Search index ready: ${stats.totalIndexed} messages indexed`);
  }
}
