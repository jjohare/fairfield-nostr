<script lang="ts">
  import { adminStore, type PendingRequest } from '$lib/stores/admin';
  import { createEventDispatcher } from 'svelte';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  const dispatch = createEventDispatcher<{
    approve: { request: PendingRequest };
    reject: { request: PendingRequest };
    batchApprove: { requests: PendingRequest[] };
    batchReject: { requests: PendingRequest[] };
  }>();

  let selectedRequests = new Set<string>();
  let filterChannel = '';
  let sortBy: 'timestamp' | 'channel' = 'timestamp';
  let sortDesc = true;

  $: filteredRequests = $adminStore.pendingRequests
    .filter(req => {
      if (filterChannel && req.channelName !== filterChannel) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'timestamp') {
        return sortDesc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
      } else {
        const comparison = a.channelName.localeCompare(b.channelName);
        return sortDesc ? -comparison : comparison;
      }
    });

  $: channels = Array.from(new Set($adminStore.pendingRequests.map(r => r.channelName))).sort();

  $: allSelected = filteredRequests.length > 0 && filteredRequests.every(r => selectedRequests.has(r.id));
  $: someSelected = selectedRequests.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      selectedRequests.clear();
    } else {
      filteredRequests.forEach(r => selectedRequests.add(r.id));
    }
    selectedRequests = selectedRequests;
  }

  function toggleSelect(id: string) {
    if (selectedRequests.has(id)) {
      selectedRequests.delete(id);
    } else {
      selectedRequests.add(id);
    }
    selectedRequests = selectedRequests;
  }

  function handleApprove(request: PendingRequest) {
    dispatch('approve', { request });
    selectedRequests.delete(request.id);
    selectedRequests = selectedRequests;
  }

  function handleReject(request: PendingRequest) {
    dispatch('reject', { request });
    selectedRequests.delete(request.id);
    selectedRequests = selectedRequests;
  }

  function handleBatchApprove() {
    const requests = filteredRequests.filter(r => selectedRequests.has(r.id));
    dispatch('batchApprove', { requests });
    selectedRequests.clear();
    selectedRequests = selectedRequests;
  }

  function handleBatchReject() {
    const requests = filteredRequests.filter(r => selectedRequests.has(r.id));
    dispatch('batchReject', { requests });
    selectedRequests.clear();
    selectedRequests = selectedRequests;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  function formatRelativeTime(ts: number): string {
    const now = Date.now() / 1000;
    const diff = now - ts;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
</script>

<div class="p-6 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Pending Join Requests</h1>
      <p class="text-base-content/70 mt-1">
        {$adminStore.pendingRequests.length} pending request{$adminStore.pendingRequests.length !== 1 ? 's' : ''}
      </p>
    </div>
  </div>

  <!-- Filters and Actions -->
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Filters -->
        <div class="flex-1 flex gap-2 flex-wrap">
          <select
            class="select select-bordered select-sm"
            bind:value={filterChannel}
          >
            <option value="">All Channels</option>
            {#each channels as channel}
              <option value={channel}>{channel}</option>
            {/each}
          </select>

          <select
            class="select select-bordered select-sm"
            bind:value={sortBy}
          >
            <option value="timestamp">Sort by Time</option>
            <option value="channel">Sort by Channel</option>
          </select>

          <button
            class="btn btn-sm btn-ghost"
            on:click={() => sortDesc = !sortDesc}
          >
            {#if sortDesc}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            {/if}
          </button>
        </div>

        <!-- Batch Actions -->
        {#if selectedRequests.size > 0}
          <div class="flex gap-2">
            <button
              class="btn btn-sm btn-success gap-2"
              on:click={handleBatchApprove}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Approve ({selectedRequests.size})
            </button>
            <button
              class="btn btn-sm btn-error gap-2"
              on:click={handleBatchReject}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject ({selectedRequests.size})
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Requests Table -->
  <div class="card bg-base-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th class="w-12">
              <label>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={allSelected}
                  indeterminate={someSelected}
                  on:click={toggleSelectAll}
                />
              </label>
            </th>
            <th>Pubkey</th>
            <th>Channel</th>
            <th>Requested</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if $adminStore.loading.requests}
            <tr>
              <td colspan="5" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>
          {:else if filteredRequests.length === 0}
            <tr>
              <td colspan="5" class="text-center py-8 text-base-content/50">
                No pending requests
              </td>
            </tr>
          {:else}
            {#each filteredRequests as request (request.id)}
              <tr>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={selectedRequests.has(request.id)}
                      on:click={() => toggleSelect(request.id)}
                    />
                  </label>
                </td>
                <td>
                  <UserDisplay
                    pubkey={request.pubkey}
                    showAvatar={true}
                    showName={true}
                    showFullName={true}
                    avatarSize="xs"
                    clickable={false}
                  />
                </td>
                <td>
                  <div class="badge badge-outline">{request.channelName}</div>
                </td>
                <td>
                  <div class="flex flex-col">
                    <span class="text-sm">{formatRelativeTime(request.timestamp)}</span>
                    <span class="text-xs text-base-content/50">{formatTimestamp(request.timestamp)}</span>
                  </div>
                </td>
                <td class="text-right">
                  <div class="flex gap-2 justify-end">
                    <button
                      class="btn btn-xs btn-success gap-1"
                      on:click={() => handleApprove(request)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      class="btn btn-xs btn-error gap-1"
                      on:click={() => handleReject(request)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Error Display -->
  {#if $adminStore.error}
    <div class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{$adminStore.error}</span>
    </div>
  {/if}
</div>
