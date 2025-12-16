# Search Feature Usage Guide

## For End Users

### Opening Search

**Keyboard Shortcut:**
- Mac: `⌘ + K`
- Windows/Linux: `Ctrl + K`

**Click:**
- Click the search icon (magnifying glass) in the navigation bar

### Searching Messages

1. **Basic Search:**
   - Type any word or phrase
   - Results appear as you type (300ms delay)
   - Results are grouped by channel

2. **Advanced Search:**
   - **AND search**: `term1 AND term2` (both must exist)
   - **OR search**: `term1 OR term2` (either can exist)
   - Default: space-separated terms use AND

3. **Keyboard Navigation:**
   - `↑` / `↓`: Navigate results
   - `Enter`: Open selected message
   - `Esc`: Close search

### Search History

- Recent searches appear when input is empty
- Click any suggestion to re-run that search
- Only searches with results are saved

### Result Information

Each result shows:
- Author name and avatar
- When the message was sent
- Highlighted matching text
- Relevance score
- Channel name (in header)

### Clicking Results

- Click any result to navigate to that message in its channel
- Message will be highlighted/scrolled into view
- Search modal closes automatically

## For Developers

### Search API

```typescript
import { searchMessages } from '$lib/utils/searchIndex';

// Basic search
const response = await searchMessages('hello');

// Advanced search with filters
const response = await searchMessages('nostr', {
  channelId: 'specific-channel-id',
  authorPubkey: 'user-pubkey',
  dateRange: {
    start: timestamp,
    end: timestamp
  },
  limit: 50,
  offset: 0
});

// Response structure
interface SearchResponse {
  results: SearchResult[];
  stats: {
    totalResults: number;
    searchTime: number; // milliseconds
    hasMore: boolean;
  };
}

interface SearchResult {
  messageId: string;
  channelId: string;
  content: string;
  authorPubkey: string;
  timestamp: number;
  score: number; // relevance score
  highlights: string[]; // text snippets with matches
}
```

### Index Management

```typescript
import {
  buildSearchIndex,
  needsIndexRebuild,
  initializeSearchIndex
} from '$lib/utils/buildSearchIndex';

// Check if rebuild needed
const needs = await needsIndexRebuild();

// Rebuild index with progress
await buildSearchIndex((current, total) => {
  console.log(`Progress: ${current}/${total}`);
});

// Auto-initialize (checks if needed first)
await initializeSearchIndex();
```

### Manual Indexing

```typescript
import {
  indexNewMessage,
  removeDeletedMessage
} from '$lib/utils/searchIndex';

// Index new message
await indexNewMessage(dbMessage);

// Remove deleted message
await removeDeletedMessage(messageId);
```

### Database Access

```typescript
import { db } from '$lib/db';

// Tokenize text
const tokens = db.tokenize('Hello world!');
// => ['hello', 'world']

// Direct index operations
await db.indexMessage(message);
await db.bulkIndexMessages(messages);
await db.removeFromIndex(messageId);
await db.clearSearchIndex();

// Search history
const history = await db.getSearchHistory(10);
await db.addSearchHistory(query, resultCount);
await db.clearSearchHistory();
```

### Index Statistics

```typescript
import { getIndexStats } from '$lib/utils/searchIndex';

const stats = await getIndexStats();
// {
//   totalIndexed: 1523,
//   oldestMessage: 1704067200,
//   newestMessage: 1704153600
// }
```

### Custom Search UI

```svelte
<script lang="ts">
  import { searchMessages } from '$lib/utils/searchIndex';
  
  let query = '';
  let results = [];
  let loading = false;
  
  async function handleSearch() {
    loading = true;
    const response = await searchMessages(query);
    results = response.results;
    loading = false;
  }
</script>

<input bind:value={query} on:input={handleSearch} />

{#if loading}
  <p>Searching...</p>
{:else}
  {#each results as result}
    <div>
      <p>{result.content}</p>
      <small>Score: {result.score}</small>
    </div>
  {/each}
{/if}
```

## Best Practices

### For Users

1. **Use specific terms**: More specific queries return better results
2. **Try operators**: Use AND/OR for complex searches
3. **Check recent searches**: Reuse common queries from history
4. **Navigate with keyboard**: Faster than clicking

### For Developers

1. **Batch operations**: Use `bulkIndexMessages` for multiple messages
2. **Error handling**: Wrap in try-catch, log but don't break
3. **Progress feedback**: Show progress for long-running builds
4. **Debounce input**: Wait 300ms+ before searching
5. **Limit results**: Use pagination for large result sets
6. **Cache channels/users**: Preload for display in results

## Performance Tips

### Optimize Searches

```typescript
// Good: Specific channel + reasonable limit
await searchMessages('term', {
  channelId: 'specific-channel',
  limit: 20
});

// Less optimal: Search everything with huge limit
await searchMessages('term', { limit: 1000 });
```

### Rebuild Strategically

```typescript
// Good: Check before rebuild
if (await needsIndexRebuild()) {
  await buildSearchIndex();
}

// Less optimal: Rebuild without checking
await db.clearSearchIndex();
await buildSearchIndex();
```

### Background Processing

```typescript
// Good: Non-blocking
indexNewMessage(message).catch(console.error);

// Less optimal: Blocking
await indexNewMessage(message);
```

## Common Issues

### Search returns no results
- Check if index is built: `await getIndexStats()`
- Try rebuilding: `await rebuildSearchIndex()`
- Verify messages exist: `await db.messages.count()`

### Search is slow
- Check index size: `await getIndexStats()`
- Use filters to narrow results
- Increase debounce delay
- Consider pagination

### Index out of sync
- Check drift: compare message count vs index count
- Rebuild if difference > 10%
- Enable auto-indexing in message store

## Examples

### Search by Author
```typescript
const results = await searchMessages('hello', {
  authorPubkey: userPubkey
});
```

### Search Last 24 Hours
```typescript
const oneDayAgo = Date.now() / 1000 - 86400;
const results = await searchMessages('term', {
  dateRange: {
    start: oneDayAgo,
    end: Date.now() / 1000
  }
});
```

### Paginated Search
```typescript
// Page 1
const page1 = await searchMessages('term', {
  limit: 20,
  offset: 0
});

// Page 2
const page2 = await searchMessages('term', {
  limit: 20,
  offset: 20
});
```

### Combined Filters
```typescript
const results = await searchMessages('nostr AND protocol', {
  channelId: 'tech-channel',
  dateRange: {
    start: weekAgo,
    end: now
  },
  limit: 50
});
```
