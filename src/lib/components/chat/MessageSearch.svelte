<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { debounce } from '$lib/utils/search';
  import type { SearchFilters } from '$lib/utils/search';

  export let isOpen = false;
  export let placeholder = 'Search messages...';

  const dispatch = createEventDispatcher<{
    search: { query: string; filters: SearchFilters };
    close: void;
  }>();

  let searchQuery = '';
  let filterScope: SearchFilters['scope'] = 'all';
  let dateFrom = '';
  let dateTo = '';
  let showAdvancedFilters = false;

  const debouncedSearch = debounce(() => {
    performSearch();
  }, 300);

  function handleInput() {
    debouncedSearch();
  }

  function performSearch() {
    const filters: SearchFilters = {
      scope: filterScope,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined
    };

    dispatch('search', { query: searchQuery, filters });
  }

  function clearSearch() {
    searchQuery = '';
    filterScope = 'all';
    dateFrom = '';
    dateTo = '';
    showAdvancedFilters = false;
    performSearch();
  }

  function handleClose() {
    clearSearch();
    dispatch('close');
  }

  $: if (filterScope || dateFrom || dateTo) {
    performSearch();
  }
</script>

{#if isOpen}
  <div class="bg-base-200 border-b border-base-300 p-4 animate-slide-down">
    <div class="container mx-auto max-w-4xl space-y-3">
      <!-- Search Input -->
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            class="input input-bordered w-full pl-10 pr-10"
            {placeholder}
            bind:value={searchQuery}
            on:input={handleInput}
            autofocus
          />
          {#if searchQuery}
            <button
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
              on:click={clearSearch}
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/50 hover:text-base-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>

        <button
          class="btn btn-ghost btn-square"
          on:click={() => showAdvancedFilters = !showAdvancedFilters}
          aria-label="Toggle filters"
          class:btn-active={showAdvancedFilters}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        <button
          class="btn btn-ghost btn-square"
          on:click={handleClose}
          aria-label="Close search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Advanced Filters -->
      {#if showAdvancedFilters}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 animate-slide-down">
          <!-- Scope Filter -->
          <div class="form-control">
            <label class="label" for="filter-scope">
              <span class="label-text text-xs">Filter by</span>
            </label>
            <select
              id="filter-scope"
              class="select select-bordered select-sm w-full"
              bind:value={filterScope}
            >
              <option value="all">All Messages</option>
              <option value="channel">This Channel</option>
              <option value="user">My Messages</option>
            </select>
          </div>

          <!-- Date From -->
          <div class="form-control">
            <label class="label" for="date-from">
              <span class="label-text text-xs">From</span>
            </label>
            <input
              id="date-from"
              type="date"
              class="input input-bordered input-sm w-full"
              bind:value={dateFrom}
              max={dateTo || new Date().toISOString().split('T')[0]}
            />
          </div>

          <!-- Date To -->
          <div class="form-control">
            <label class="label" for="date-to">
              <span class="label-text text-xs">To</span>
            </label>
            <input
              id="date-to"
              type="date"
              class="input input-bordered input-sm w-full"
              bind:value={dateTo}
              min={dateFrom}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      {/if}

      <!-- Active Filters Summary -->
      {#if searchQuery || filterScope !== 'all' || dateFrom || dateTo}
        <div class="flex flex-wrap gap-2 text-sm">
          <span class="text-base-content/60">Active filters:</span>
          {#if searchQuery}
            <span class="badge badge-primary badge-sm gap-1">
              Search: "{searchQuery}"
              <button on:click={() => { searchQuery = ''; performSearch(); }} class="hover:text-primary-content/70">✕</button>
            </span>
          {/if}
          {#if filterScope !== 'all'}
            <span class="badge badge-secondary badge-sm gap-1">
              {filterScope === 'channel' ? 'This Channel' : 'My Messages'}
              <button on:click={() => { filterScope = 'all'; performSearch(); }} class="hover:text-secondary-content/70">✕</button>
            </span>
          {/if}
          {#if dateFrom || dateTo}
            <span class="badge badge-accent badge-sm gap-1">
              {dateFrom ? new Date(dateFrom).toLocaleDateString() : '...'} - {dateTo ? new Date(dateTo).toLocaleDateString() : '...'}
              <button on:click={() => { dateFrom = ''; dateTo = ''; performSearch(); }} class="hover:text-accent-content/70">✕</button>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-down {
    animation: slide-down 0.2s ease-out;
  }
</style>
