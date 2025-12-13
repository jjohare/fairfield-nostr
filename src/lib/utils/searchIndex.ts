import { db, type DBMessage, type DBSearchIndex } from '$lib/db';

/**
 * Search options for filtering results
 */
export interface SearchOptions {
  channelId?: string;
  authorPubkey?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  limit?: number;
  offset?: number;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  messageId: string;
  channelId: string;
  content: string;
  authorPubkey: string;
  timestamp: number;
  score: number;
  highlights: string[];
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalResults: number;
  searchTime: number;
  hasMore: boolean;
}

/**
 * Combined search response
 */
export interface SearchResponse {
  results: SearchResult[];
  stats: SearchStats;
}

/**
 * Build complete search index from all cached messages
 */
export async function buildSearchIndex(onProgress?: (current: number, total: number) => void): Promise<void> {
  const startTime = performance.now();

  // Clear existing index
  await db.clearSearchIndex();

  // Get all non-deleted messages
  const messages = await db.messages
    .where('deleted')
    .equals(0)
    .toArray();

  const total = messages.length;
  const batchSize = 100;

  // Process in batches to avoid blocking UI
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await db.bulkIndexMessages(batch);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }

    // Allow UI to breathe between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const endTime = performance.now();
  console.log(`Search index built: ${total} messages in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Parse search query for operators (AND, OR)
 */
function parseSearchQuery(query: string): { terms: string[], operator: 'AND' | 'OR' } {
  const normalized = query.trim().toLowerCase();

  // Check for OR operator
  if (normalized.includes(' or ')) {
    const terms = normalized
      .split(' or ')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    return { terms, operator: 'OR' };
  }

  // Check for AND operator (or default)
  const terms = normalized
    .split(/\s+and\s+|\s+/)
    .filter(t => t.length > 1);

  return { terms, operator: 'AND' };
}

/**
 * Calculate relevance score for a search result
 */
function calculateScore(
  searchTerms: string[],
  tokens: string[],
  content: string,
  timestamp: number
): number {
  let score = 0;
  const contentLower = content.toLowerCase();

  searchTerms.forEach(term => {
    // Exact phrase match (highest score)
    if (contentLower.includes(term)) {
      score += 10;
    }

    // Token matches
    const matchCount = tokens.filter(token => token.includes(term) || term.includes(token)).length;
    score += matchCount * 5;

    // Bonus for match at start of content
    if (contentLower.startsWith(term)) {
      score += 3;
    }
  });

  // Recency bonus (newer messages get slight boost)
  const daysSinceMessage = (Date.now() / 1000 - timestamp) / (24 * 60 * 60);
  const recencyBonus = Math.max(0, 5 - daysSinceMessage / 30);
  score += recencyBonus;

  return score;
}

/**
 * Extract highlights from content
 */
function extractHighlights(content: string, searchTerms: string[], maxHighlights: number = 3): string[] {
  const highlights: string[] = [];
  const contentLower = content.toLowerCase();

  for (const term of searchTerms) {
    const index = contentLower.indexOf(term);
    if (index !== -1) {
      // Extract context around match (40 chars before and after)
      const start = Math.max(0, index - 40);
      const end = Math.min(content.length, index + term.length + 40);

      let highlight = content.substring(start, end);

      // Add ellipsis if truncated
      if (start > 0) highlight = '...' + highlight;
      if (end < content.length) highlight = highlight + '...';

      highlights.push(highlight);

      if (highlights.length >= maxHighlights) break;
    }
  }

  return highlights;
}

/**
 * Search messages with full-text search
 */
export async function searchMessages(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = performance.now();

  if (!query || query.trim().length < 2) {
    return {
      results: [],
      stats: {
        totalResults: 0,
        searchTime: 0,
        hasMore: false
      }
    };
  }

  const { terms, operator } = parseSearchQuery(query);
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  // Start with all search index entries
  let collection = db.searchIndex.toCollection();

  // Apply channel filter
  if (options.channelId) {
    collection = db.searchIndex.where('channelId').equals(options.channelId);
  }

  // Apply author filter
  if (options.authorPubkey) {
    collection = collection.and(entry => entry.authorPubkey === options.authorPubkey);
  }

  // Apply date range filter
  if (options.dateRange) {
    collection = collection.and(entry =>
      entry.timestamp >= options.dateRange!.start &&
      entry.timestamp <= options.dateRange!.end
    );
  }

  // Get all candidates
  const candidates = await collection.toArray();

  // Score and filter results
  const scoredResults: SearchResult[] = [];

  for (const entry of candidates) {
    let matches = false;

    if (operator === 'AND') {
      // All terms must match
      matches = terms.every(term =>
        entry.tokens.some(token => token.includes(term) || term.includes(token))
      );
    } else {
      // Any term can match
      matches = terms.some(term =>
        entry.tokens.some(token => token.includes(term) || term.includes(token))
      );
    }

    if (matches) {
      const score = calculateScore(terms, entry.tokens, entry.content, entry.timestamp);
      const highlights = extractHighlights(entry.content, terms);

      scoredResults.push({
        messageId: entry.messageId,
        channelId: entry.channelId,
        content: entry.content,
        authorPubkey: entry.authorPubkey,
        timestamp: entry.timestamp,
        score,
        highlights
      });
    }
  }

  // Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);

  // Paginate
  const totalResults = scoredResults.length;
  const paginatedResults = scoredResults.slice(offset, offset + limit);
  const hasMore = offset + limit < totalResults;

  const endTime = performance.now();
  const searchTime = endTime - startTime;

  // Save to search history
  await db.addSearchHistory(query, totalResults);

  return {
    results: paginatedResults,
    stats: {
      totalResults,
      searchTime,
      hasMore
    }
  };
}

/**
 * Get search suggestions based on history
 */
export async function getSearchSuggestions(limit: number = 5): Promise<string[]> {
  const history = await db.getSearchHistory(limit);
  return history
    .filter(h => h.resultCount > 0) // Only suggest queries that had results
    .map(h => h.query);
}

/**
 * Index a new message (called when message is received)
 */
export async function indexNewMessage(message: DBMessage): Promise<void> {
  await db.indexMessage(message);
}

/**
 * Remove deleted message from index
 */
export async function removeDeletedMessage(messageId: string): Promise<void> {
  await db.removeFromIndex(messageId);
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  totalIndexed: number;
  oldestMessage: number;
  newestMessage: number;
}> {
  const count = await db.searchIndex.count();

  if (count === 0) {
    return {
      totalIndexed: 0,
      oldestMessage: 0,
      newestMessage: 0
    };
  }

  const oldest = await db.searchIndex.orderBy('timestamp').first();
  const newest = await db.searchIndex.orderBy('timestamp').reverse().first();

  return {
    totalIndexed: count,
    oldestMessage: oldest?.timestamp || 0,
    newestMessage: newest?.timestamp || 0
  };
}
