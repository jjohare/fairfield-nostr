<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { searchMessages, getSearchSuggestions, type SearchResult, type SearchResponse } from '$lib/utils/searchIndex';
  import { db } from '$lib/db';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Loading from '$lib/components/ui/Loading.svelte';

  export let isOpen = false;
  export let onClose: () => void;

  let query = '';
  let searchResults: SearchResult[] = [];
  let searchStats: SearchResponse['stats'] | null = null;
  let loading = false;
  let suggestions: string[] = [];
  let channelsMap = new Map<string, { name: string; id: string }>();
  let usersMap = new Map<string, { name: string; avatar?: string }>();
  let searchTimeout: ReturnType<typeof setTimeout>;
  let selectedIndex = -1;

  // Group results by channel
  $: groupedResults = searchResults.reduce((acc, result) => {
    const channelName = channelsMap.get(result.channelId)?.name || 'Unknown Channel';
    if (!acc[channelName]) {
      acc[channelName] = [];
    }
    acc[channelName].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  onMount(async () => {
    // Load suggestions
    suggestions = await getSearchSuggestions(5);

    // Preload channels and users for display
    const channels = await db.channels.toArray();
    channels.forEach(ch => {
      channelsMap.set(ch.id, { name: ch.name, id: ch.id });
    });
    channelsMap = channelsMap; // Trigger reactivity

    const users = await db.users.toArray();
    users.forEach(u => {
      usersMap.set(u.pubkey, {
        name: u.displayName || u.name || 'Anonymous',
        avatar: u.avatar || undefined
      });
    });
    usersMap = usersMap;
  });

  async function performSearch() {
    if (query.trim().length < 2) {
      searchResults = [];
      searchStats = null;
      return;
    }

    loading = true;
    try {
      const response = await searchMessages(query, { limit: 50 });
      searchResults = response.results;
      searchStats = response.stats;
      selectedIndex = -1;
    } catch (error) {
      console.error('Search failed:', error);
      searchResults = [];
      searchStats = null;
    } finally {
      loading = false;
    }
  }

  function handleInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch();
    }, 300); // Debounce 300ms
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      navigateToMessage(searchResults[selectedIndex]);
    }
  }

  function navigateToMessage(result: SearchResult) {
    const channelId = result.channelId;
    goto(`${base}/chat/${channelId}#msg-${result.messageId}`);
    onClose();
  }

  function useSuggestion(suggestion: string) {
    query = suggestion;
    performSearch();
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  onDestroy(() => {
    clearTimeout(searchTimeout);
  });
</script>

{#if isOpen}
  <Modal {onClose} title="Search Messages" size="large">
    <div class="search-container">
      <div class="search-input-wrapper">
        <input
          type="text"
          bind:value={query}
          on:input={handleInput}
          on:keydown={handleKeydown}
          placeholder="Search messages (use 'AND' or 'OR' for operators)..."
          class="search-input"
          autofocus
        />
        {#if loading}
          <div class="search-loading">
            <Loading size="small" />
          </div>
        {/if}
      </div>

      {#if searchStats}
        <div class="search-stats">
          Found {searchStats.totalResults} result{searchStats.totalResults === 1 ? '' : 's'}
          in {searchStats.searchTime.toFixed(0)}ms
        </div>
      {/if}

      {#if suggestions.length > 0 && !query && !searchResults.length}
        <div class="suggestions">
          <h4>Recent Searches</h4>
          <div class="suggestion-list">
            {#each suggestions as suggestion}
              <button
                class="suggestion-item"
                on:click={() => useSuggestion(suggestion)}
              >
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                {suggestion}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if searchResults.length > 0}
        <div class="results">
          {#each Object.entries(groupedResults) as [channelName, results]}
            <div class="channel-group">
              <h3 class="channel-name">{channelName}</h3>
              <div class="result-list">
                {#each results as result, index}
                  {@const globalIndex = searchResults.indexOf(result)}
                  {@const author = usersMap.get(result.authorPubkey)}
                  <button
                    class="result-item"
                    class:selected={globalIndex === selectedIndex}
                    on:click={() => navigateToMessage(result)}
                  >
                    <div class="result-header">
                      <div class="author-info">
                        {#if author?.avatar}
                          <img src={author.avatar} alt={author.name} class="author-avatar" />
                        {:else}
                          <div class="author-avatar-placeholder">
                            {(author?.name || 'A')[0].toUpperCase()}
                          </div>
                        {/if}
                        <span class="author-name">{author?.name || 'Anonymous'}</span>
                      </div>
                      <span class="timestamp">{formatTimestamp(result.timestamp)}</span>
                    </div>
                    <div class="result-content">
                      {#if result.highlights.length > 0}
                        {#each result.highlights as highlight}
                          <div class="highlight">{highlight}</div>
                        {/each}
                      {:else}
                        <div class="content-preview">
                          {result.content.substring(0, 150)}{result.content.length > 150 ? '...' : ''}
                        </div>
                      {/if}
                    </div>
                    <div class="result-footer">
                      <span class="score">Relevance: {result.score.toFixed(1)}</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else if query && !loading}
        <div class="no-results">
          <p>No messages found matching "{query}"</p>
          <p class="help-text">Try using different keywords or operators (AND/OR)</p>
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .search-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 70vh;
    overflow: hidden;
  }

  .search-input-wrapper {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #667eea;
  }

  .search-loading {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .search-stats {
    padding: 0.5rem 1rem;
    background: #f7fafc;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #4a5568;
  }

  .suggestions {
    padding: 1rem;
  }

  .suggestions h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    color: #718096;
    font-weight: 600;
    text-transform: uppercase;
  }

  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    text-align: left;
  }

  .suggestion-item:hover {
    background: #edf2f7;
    border-color: #cbd5e0;
  }

  .suggestion-item .icon {
    width: 16px;
    height: 16px;
    fill: #a0aec0;
  }

  .results {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .channel-group {
    margin-bottom: 1.5rem;
  }

  .channel-name {
    margin: 0 0 0.75rem 0;
    padding: 0.5rem 0.75rem;
    background: #667eea;
    color: white;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .result-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .result-item {
    padding: 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .result-item:hover,
  .result-item.selected {
    background: #f7fafc;
    border-color: #667eea;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .author-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .author-avatar-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #667eea;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .author-name {
    font-weight: 600;
    color: #2d3748;
    font-size: 0.875rem;
  }

  .timestamp {
    font-size: 0.75rem;
    color: #a0aec0;
  }

  .result-content {
    margin-bottom: 0.5rem;
  }

  .highlight {
    padding: 0.5rem;
    background: #fef5e7;
    border-left: 3px solid #f9a825;
    font-size: 0.875rem;
    color: #2d3748;
    margin-bottom: 0.25rem;
    border-radius: 4px;
  }

  .content-preview {
    font-size: 0.875rem;
    color: #4a5568;
    line-height: 1.5;
  }

  .result-footer {
    display: flex;
    justify-content: flex-end;
  }

  .score {
    font-size: 0.75rem;
    color: #a0aec0;
  }

  .no-results {
    padding: 2rem;
    text-align: center;
    color: #718096;
  }

  .no-results p {
    margin: 0.5rem 0;
  }

  .help-text {
    font-size: 0.875rem;
    color: #a0aec0;
  }

  @media (max-width: 640px) {
    .search-container {
      max-height: 80vh;
    }

    .result-item {
      padding: 0.75rem;
    }

    .channel-name {
      font-size: 0.8125rem;
    }
  }
</style>
