<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore, isAdmin } from '$lib/stores/auth';
  import { setSigner, connectNDK, getRelayUrls } from '$lib/nostr/ndk';
  import { createChannel, fetchChannels, type CreatedChannel } from '$lib/nostr/channels';

  let stats = {
    totalUsers: 0,
    totalChannels: 0,
    totalMessages: 0,
    pendingApprovals: 0
  };

  let channels: CreatedChannel[] = [];
  let isLoading = false;
  let error: string | null = null;
  let showCreateForm = false;
  let relayStatus = 'disconnected';

  // Form fields
  let formName = '';
  let formDescription = '';
  let formVisibility: 'public' | 'cohort' | 'private' = 'public';
  let formCohorts = '';
  let formEncrypted = false;

  async function initializeAdmin() {
    if (!$authStore.privateKey) {
      error = 'Please login first to access admin features';
      return;
    }

    try {
      isLoading = true;
      error = null;

      // Set up signer with user's private key
      setSigner($authStore.privateKey);

      // Connect to relays
      await connectNDK();
      relayStatus = 'connected';

      // Fetch existing channels
      channels = await fetchChannels();
      stats.totalChannels = channels.length;

    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to initialize admin';
      relayStatus = 'error';
    } finally {
      isLoading = false;
    }
  }

  async function handleCreateChannel() {
    if (!formName.trim()) {
      error = 'Channel name is required';
      return;
    }

    try {
      isLoading = true;
      error = null;

      const cohorts = formCohorts.split(',').map(c => c.trim()).filter(Boolean);

      const newChannel = await createChannel({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        visibility: formVisibility,
        cohorts,
        encrypted: formEncrypted,
      });

      channels = [newChannel, ...channels];
      stats.totalChannels = channels.length;

      // Reset form
      formName = '';
      formDescription = '';
      formVisibility = 'public';
      formCohorts = '';
      formEncrypted = false;
      showCreateForm = false;

    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create channel';
    } finally {
      isLoading = false;
    }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString();
  }

  function getVisibilityBadge(visibility: string): string {
    const badges: Record<string, string> = {
      public: 'badge-success',
      cohort: 'badge-warning',
      private: 'badge-error',
    };
    return badges[visibility] || 'badge-ghost';
  }

  onMount(() => {
    if (!$isAdmin) {
      goto(`${base}/chat`);
      return;
    }

    initializeAdmin();
  });
</script>

<svelte:head>
  <title>Admin Dashboard - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <div class="mb-6">
    <h1 class="text-4xl font-bold gradient-text mb-2">Admin Dashboard</h1>
    <p class="text-base-content/70">System overview and management</p>
    <div class="mt-2 flex items-center gap-2">
      <span class="badge {relayStatus === 'connected' ? 'badge-success' : relayStatus === 'error' ? 'badge-error' : 'badge-warning'}">
        {relayStatus}
      </span>
      <span class="text-sm text-base-content/50">Relay Status</span>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
      <button class="btn btn-ghost btn-sm" on:click={() => error = null}>Dismiss</button>
    </div>
  {/if}

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <div class="stat-value text-primary">{stats.totalUsers}</div>
        <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Users</div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <div class="stat-value text-primary">{stats.totalChannels}</div>
        <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Channels</div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <div class="stat-value text-primary">{stats.totalMessages}</div>
        <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Messages</div>
      </div>
    </div>

    <div class="card bg-warning/20 border border-warning">
      <div class="card-body items-center text-center">
        <div class="stat-value text-warning">{stats.pendingApprovals}</div>
        <div class="text-sm text-base-content/70 uppercase tracking-wide">Pending Approvals</div>
      </div>
    </div>
  </div>

  <!-- Channel Management Section -->
  <div class="card bg-base-200 mb-6">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title">Channel Management</h2>
        <button
          class="btn btn-primary gap-2"
          on:click={() => showCreateForm = !showCreateForm}
          disabled={isLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Channel
        </button>
      </div>

      <!-- Create Channel Form -->
      {#if showCreateForm}
        <div class="mt-4 p-4 bg-base-300 rounded-lg">
          <h3 class="font-semibold mb-4">New Channel</h3>

          <div class="form-control mb-3">
            <label class="label">
              <span class="label-text">Channel Name *</span>
            </label>
            <input
              type="text"
              placeholder="Enter channel name"
              class="input input-bordered"
              bind:value={formName}
            />
          </div>

          <div class="form-control mb-3">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <textarea
              class="textarea textarea-bordered"
              placeholder="Channel description (optional)"
              rows="2"
              bind:value={formDescription}
            ></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Visibility</span>
              </label>
              <select class="select select-bordered" bind:value={formVisibility}>
                <option value="public">Public</option>
                <option value="cohort">Cohort Only</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Cohorts (comma-separated)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2024, 2025"
                class="input input-bordered"
                bind:value={formCohorts}
              />
            </div>
          </div>

          <div class="form-control mb-4">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="toggle toggle-primary"
                bind:checked={formEncrypted}
              />
              <span class="label-text">Encrypted Messages</span>
            </label>
          </div>

          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" on:click={() => showCreateForm = false}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              on:click={handleCreateChannel}
              disabled={isLoading || !formName.trim()}
            >
              {#if isLoading}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Create Channel
            </button>
          </div>
        </div>
      {/if}

      <!-- Channels List -->
      <div class="mt-4">
        {#if isLoading && channels.length === 0}
          <div class="text-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
            <p class="mt-2 text-base-content/70">Loading channels...</p>
          </div>
        {:else if channels.length === 0}
          <div class="text-center py-8 text-base-content/50">
            <p>No channels yet. Create your first channel above.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each channels as channel (channel.id)}
              <div class="card bg-base-300">
                <div class="card-body p-4">
                  <h3 class="font-semibold">{channel.name}</h3>
                  {#if channel.description}
                    <p class="text-sm text-base-content/70 line-clamp-2">{channel.description}</p>
                  {/if}
                  <div class="flex flex-wrap gap-1 mt-2">
                    <span class="badge {getVisibilityBadge(channel.visibility)} badge-sm">
                      {channel.visibility}
                    </span>
                    {#if channel.encrypted}
                      <span class="badge badge-info badge-sm">Encrypted</span>
                    {/if}
                    {#each channel.cohorts as cohort}
                      <span class="badge badge-outline badge-sm">{cohort}</span>
                    {/each}
                  </div>
                  <div class="text-xs text-base-content/50 mt-2">
                    Created {formatTimestamp(channel.createdAt)}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">User Management</h2>
        <p class="text-sm text-base-content/70">Manage user approvals and permissions</p>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary btn-sm">View Users</button>
        </div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">Pending Approvals</h2>
        <p class="text-sm text-base-content/70">Review and approve join requests</p>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary btn-sm">View Requests</button>
        </div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">System Settings</h2>
        <p class="text-sm text-base-content/70">Configure relay settings and policies</p>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary btn-sm">Settings</button>
        </div>
      </div>
    </div>
  </div>
</div>
