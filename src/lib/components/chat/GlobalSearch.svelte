<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { searchMessages, getSearchSuggestions, type SearchResult, type SearchResponse } from '$lib/utils/searchIndex';
  import { db } from '$lib/db';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Loading from '$lib/components/ui/Loading.svelte';
  import {
    searchSimilar,
    isSearchAvailable,
    getSearchStats,
    loadIndex,
    type SearchResult as SemanticResult
  } from '$lib/semantic/hnsw-search';
  import { getLocalSyncState, syncEmbeddings, shouldSync } from '$lib/semantic/embeddings-sync';
  import { sectionStore, accessibleSections } from '$lib/stores/sections';
  import type { ChannelSection } from '$lib/types/channel';

  export let isOpen = false;
  export let onClose: () => void;

  // Search mode: 'text' or 'semantic'
  let searchMode: 'text' | 'semantic' = 'text';

  let query = '';
  let searchResults: SearchResult[] = [];
  let searchStats: SearchResponse['stats'] | null = null;
  let loading = false;
  let suggestions: string[] = [];
  let channelsMap = new Map<string, { name: string; id: string }>();
  let usersMap = new Map<string, { name: string; avatar?: string }>();
  let searchTimeout: ReturnType<typeof setTimeout>;
  let selectedIndex = -1;

  // Semantic search state
  let semanticResults: SemanticResult[] = [];
  let semanticIndexLoaded = false;
  let semanticStats: { vectorCount: number; dimensions: number } | null = null;
  let semanticSyncState: { version: number; lastSynced: number } | null = null;
  let syncingEmbeddings = false;

  // Channel-to-section cache for authorization filtering
  let channelSectionCache = new Map<string, ChannelSection>();

  /**
   * Get the section for a channel, with caching
   */
  async function getChannelSection(channelId: string): Promise<ChannelSection | null> {
    if (channelSectionCache.has(channelId)) {
      return channelSectionCache.get(channelId)!;
    }

    try {
      const channel = await db.channels.get(channelId);
      if (channel) {
        // Extract section from tags or default to fairfield-guests
        const sectionTag = channel.tags?.find((t: string[]) => t[0] === 'section')?.[1];
        const section = (sectionTag || 'fairfield-guests') as ChannelSection;
        channelSectionCache.set(channelId, section);
        return section;
      }
    } catch (e) {
      console.warn('Failed to get channel section:', e);
    }
    return null;
  }

  /**
   * Filter semantic results to only include messages from sections the user can access
   * This prevents privacy leakage through semantic search
   */
  async function filterResultsByAuthorization(
    results: SemanticResult[]
  ): Promise<SemanticResult[]> {
    const authorizedResults: SemanticResult[] = [];

    for (const result of results) {
      try {
        // Get the message to find its channel
        const message = await db.messages.get(result.noteId);
        if (!message) continue;

        // Get the channel's section
        const section = await getChannelSection(message.channelId);
        if (!section) continue;

        // Check if user has access to this section
        if (sectionStore.canAccessSection(section)) {
          authorizedResults.push(result);
        }
      } catch (e) {
        // Skip results we can't verify access for
        console.warn('Failed to check authorization for result:', result.noteId);
      }
    }

    return authorizedResults;
  }

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

    // Load semantic search state
    const state = await getLocalSyncState();
    if (state) {
      semanticSyncState = { version: state.version, lastSynced: state.lastSynced };
    }

    // Try to load semantic index
    if (state?.version) {
      try {
        semanticIndexLoaded = await loadIndex();
        if (semanticIndexLoaded) {
          semanticStats = getSearchStats();
        }
      } catch (e) {
        console.warn('Failed to load semantic search index:', e);
      }
    }
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
      if (searchMode === 'text') {
        performSearch();
      } else {
        performSemanticSearch();
      }
    }, 300); // Debounce 300ms
  }

  async function performSemanticSearch() {
    if (query.trim().length < 2) {
      semanticResults = [];
      return;
    }

    if (!semanticIndexLoaded) {
      return;
    }

    loading = true;
    try {
      // Fetch more results than needed to account for authorization filtering
      const rawResults = await searchSimilar(query, 30, 0.3);

      // SECURITY: Filter results to only show messages from authorized sections
      // This prevents privacy leakage through semantic search
      const authorizedResults = await filterResultsByAuthorization(rawResults);

      // Limit to requested count after filtering
      semanticResults = authorizedResults.slice(0, 10);
      selectedIndex = -1;
    } catch (error) {
      console.error('Semantic search failed:', error);
      semanticResults = [];
    } finally {
      loading = false;
    }
  }

  async function syncSemanticIndex() {
    if (!shouldSync()) {
      return;
    }

    syncingEmbeddings = true;
    try {
      const result = await syncEmbeddings(true);
      if (result.synced) {
        semanticSyncState = { version: result.version, lastSynced: Date.now() };
        semanticIndexLoaded = await loadIndex();
        if (semanticIndexLoaded) {
          semanticStats = getSearchStats();
        }
      }
    } catch (error) {
      console.error('Failed to sync embeddings:', error);
    } finally {
      syncingEmbeddings = false;
    }
  }

  function switchMode(mode: 'text' | 'semantic') {
    searchMode = mode;
    // Clear results when switching
    searchResults = [];
    semanticResults = [];
    searchStats = null;
    selectedIndex = -1;
    // Re-search if query exists
    if (query.trim().length >= 2) {
      if (mode === 'text') {
        performSearch();
      } else {
        performSemanticSearch();
      }
    }
  }

  async function navigateToSemanticResult(noteId: string) {
    // Get the message from db to find channel
    try {
      const message = await db.messages.get(noteId);
      if (message) {
        // SECURITY: Double-check authorization before navigation (defense in depth)
        const section = await getChannelSection(message.channelId);
        if (section && !sectionStore.canAccessSection(section)) {
          console.warn('Access denied to message from unauthorized section');
          return;
        }

        goto(`${base}/chat/${message.channelId}#msg-${noteId}`);
        onClose();
      }
    } catch (e) {
      console.error('Failed to navigate to message:', e);
    }
  }

  function formatSyncDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
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
      <!-- Search Mode Tabs -->
      <div class="search-tabs">
        <button
          class="tab-btn"
          class:active={searchMode === 'text'}
          on:click={() => switchMode('text')}
        >
          <svg viewBox="0 0 24 24" class="tab-icon">
            <path fill="currentColor" d="M9.5 3A6.5 6.5 0 0116 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 019.5 16 6.5 6.5 0 013 9.5 6.5 6.5 0 019.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
          </svg>
          Text Search
        </button>
        <button
          class="tab-btn"
          class:active={searchMode === 'semantic'}
          on:click={() => switchMode('semantic')}
        >
          <svg viewBox="0 0 24 24" class="tab-icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          Semantic Search
        </button>
      </div>

      <div class="search-input-wrapper">
        <input
          type="text"
          bind:value={query}
          on:input={handleInput}
          on:keydown={handleKeydown}
          placeholder={searchMode === 'text'
            ? "Search messages (use 'AND' or 'OR' for operators)..."
            : "Search by meaning or concept..."}
          class="search-input"
          autofocus
        />
        {#if loading || syncingEmbeddings}
          <div class="search-loading">
            <Loading size="small" />
          </div>
        {/if}
      </div>

      <!-- Text Search Stats -->
      {#if searchMode === 'text' && searchStats}
        <div class="search-stats">
          Found {searchStats.totalResults} result{searchStats.totalResults === 1 ? '' : 's'}
          in {searchStats.searchTime.toFixed(0)}ms
        </div>
      {/if}

      <!-- Semantic Search Status -->
      {#if searchMode === 'semantic'}
        {#if !semanticIndexLoaded}
          <div class="semantic-setup">
            <div class="setup-info">
              <svg viewBox="0 0 24 24" class="info-icon">
                <path fill="currentColor" d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z"/>
              </svg>
              <div>
                <p class="setup-title">Semantic Search Setup Required</p>
                <p class="setup-desc">Download the search index to enable AI-powered search by meaning.</p>
              </div>
            </div>
            {#if shouldSync()}
              <button
                class="sync-btn"
                on:click={syncSemanticIndex}
                disabled={syncingEmbeddings}
              >
                {#if syncingEmbeddings}
                  Downloading...
                {:else}
                  Download Index
                {/if}
              </button>
            {:else}
              <p class="wifi-notice">Connect to WiFi to download.</p>
            {/if}
          </div>
        {:else if semanticStats}
          <div class="search-stats semantic-stats">
            <span>{semanticStats.vectorCount.toLocaleString()} messages indexed</span>
            {#if semanticSyncState}
              <span>v{semanticSyncState.version} | {formatSyncDate(semanticSyncState.lastSynced)}</span>
            {/if}
            <button class="refresh-btn" on:click={syncSemanticIndex} disabled={syncingEmbeddings} title="Refresh index">
              <svg viewBox="0 0 24 24" class="refresh-icon" class:spinning={syncingEmbeddings}>
                <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
          </div>
        {/if}
      {/if}

      <!-- Suggestions (text mode only) -->
      {#if searchMode === 'text' && suggestions.length > 0 && !query && !searchResults.length}
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

      <!-- Text Search Results -->
      {#if searchMode === 'text'}
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
      {/if}

      <!-- Semantic Search Results -->
      {#if searchMode === 'semantic' && semanticIndexLoaded}
        {#if semanticResults.length > 0}
          <div class="results">
            <div class="result-list semantic-results">
              {#each semanticResults as result, index}
                <button
                  class="result-item semantic-result"
                  class:selected={index === selectedIndex}
                  on:click={() => navigateToSemanticResult(result.noteId)}
                >
                  <div class="result-header">
                    <span class="note-id">Message: {result.noteId.slice(0, 12)}...</span>
                    <span class="match-score">{(result.score * 100).toFixed(0)}% match</span>
                  </div>
                  <div class="semantic-hint">
                    Click to view message in channel
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else if query && !loading && semanticIndexLoaded}
          <div class="no-results">
            <p>No semantically similar messages found</p>
            <p class="help-text">Try describing what you're looking for in different words</p>
          </div>
        {/if}
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

  /* Search Mode Tabs */
  .search-tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem;
    background: #f7fafc;
    border-radius: 8px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #718096;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: #edf2f7;
    color: #4a5568;
  }

  .tab-btn.active {
    background: white;
    color: #667eea;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tab-icon {
    width: 18px;
    height: 18px;
  }

  /* Semantic Search Setup */
  .semantic-setup {
    padding: 1rem;
    background: #f0f7ff;
    border: 1px solid #bee3f8;
    border-radius: 8px;
  }

  .setup-info {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .info-icon {
    width: 24px;
    height: 24px;
    color: #3182ce;
    flex-shrink: 0;
  }

  .setup-title {
    font-weight: 600;
    color: #2d3748;
    margin: 0 0 0.25rem 0;
  }

  .setup-desc {
    font-size: 0.875rem;
    color: #4a5568;
    margin: 0;
  }

  .sync-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #3182ce;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .sync-btn:hover:not(:disabled) {
    background: #2c5282;
  }

  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wifi-notice {
    text-align: center;
    font-size: 0.875rem;
    color: #718096;
    margin: 0;
  }

  /* Semantic Stats */
  .semantic-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .refresh-btn {
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn:hover:not(:disabled) {
    background: #e2e8f0;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-icon {
    width: 18px;
    height: 18px;
    color: #718096;
  }

  .refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Semantic Results */
  .semantic-results {
    padding: 0.5rem;
  }

  .semantic-result {
    background: linear-gradient(135deg, #f6f8fb 0%, #fff 100%);
  }

  .note-id {
    font-family: monospace;
    font-size: 0.875rem;
    color: #4a5568;
  }

  .match-score {
    font-size: 0.75rem;
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .semantic-hint {
    font-size: 0.75rem;
    color: #a0aec0;
    margin-top: 0.25rem;
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

    .search-tabs {
      flex-direction: column;
    }

    .tab-btn {
      justify-content: flex-start;
    }
  }
</style>
