<script lang="ts">
  import { adminStore } from '$lib/stores/admin';
  import { onMount } from 'svelte';

  export let onNavigate: (page: string) => void;

  $: stats = {
    pendingRequests: $adminStore.pendingRequests.length,
    totalUsers: $adminStore.users.length,
    activeUsers: $adminStore.users.filter(u => !u.isBanned).length,
    bannedUsers: $adminStore.users.filter(u => u.isBanned).length,
    totalChannels: $adminStore.channels.length,
    publicChannels: $adminStore.channels.filter(c => c.visibility === 'public').length,
    cohortChannels: $adminStore.channels.filter(c => c.visibility === 'cohort').length,
    privateChannels: $adminStore.channels.filter(c => c.visibility === 'private').length,
  };

  $: recentActivity = [
    ...$adminStore.pendingRequests.slice(0, 5).map(req => ({
      type: 'request' as const,
      timestamp: req.timestamp,
      description: `Join request from ${truncatePubkey(req.pubkey)} for ${req.channelName}`,
    })),
    ...$adminStore.users
      .filter(u => u.lastSeen)
      .slice(0, 5)
      .map(u => ({
        type: 'activity' as const,
        timestamp: u.lastSeen!,
        description: `${u.name || truncatePubkey(u.pubkey)} was active`,
      })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  function truncatePubkey(pubkey: string): string {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }

  function formatTimestamp(ts: number): string {
    const now = Date.now() / 1000;
    const diff = now - ts;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
</script>

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">Admin Dashboard</h1>
      <p class="text-base-content/70 mt-1">Minimoomaa Noir Administration</p>
    </div>

    <div class="flex gap-2">
      <button class="btn btn-outline btn-sm" on:click={() => window.location.reload()}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Pending Requests -->
    <div class="stat bg-base-200 rounded-lg shadow-sm">
      <div class="stat-figure text-warning">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="stat-title">Pending Requests</div>
      <div class="stat-value text-warning">{stats.pendingRequests}</div>
      <div class="stat-actions">
        <button class="btn btn-sm btn-warning" on:click={() => onNavigate('requests')}>
          Review
        </button>
      </div>
    </div>

    <!-- Total Users -->
    <div class="stat bg-base-200 rounded-lg shadow-sm">
      <div class="stat-figure text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <div class="stat-title">Total Users</div>
      <div class="stat-value text-primary">{stats.totalUsers}</div>
      <div class="stat-desc">{stats.activeUsers} active, {stats.bannedUsers} banned</div>
      <div class="stat-actions">
        <button class="btn btn-sm btn-primary" on:click={() => onNavigate('users')}>
          Manage
        </button>
      </div>
    </div>

    <!-- Total Channels -->
    <div class="stat bg-base-200 rounded-lg shadow-sm">
      <div class="stat-figure text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </div>
      <div class="stat-title">Total Channels</div>
      <div class="stat-value text-secondary">{stats.totalChannels}</div>
      <div class="stat-desc">
        {stats.publicChannels} public, {stats.cohortChannels} cohort, {stats.privateChannels} private
      </div>
      <div class="stat-actions">
        <button class="btn btn-sm btn-secondary" on:click={() => onNavigate('channels')}>
          Manage
        </button>
      </div>
    </div>

    <!-- System Status -->
    <div class="stat bg-base-200 rounded-lg shadow-sm">
      <div class="stat-figure text-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="stat-title">System Status</div>
      <div class="stat-value text-success text-2xl">Operational</div>
      <div class="stat-desc">All services running</div>
    </div>
  </div>

  <!-- Quick Links -->
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body">
      <h2 class="card-title">Quick Links</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <button
          class="btn btn-outline justify-start gap-2"
          on:click={() => onNavigate('requests')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending Requests ({stats.pendingRequests})
        </button>

        <button
          class="btn btn-outline justify-start gap-2"
          on:click={() => onNavigate('users')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          User Management ({stats.totalUsers})
        </button>

        <button
          class="btn btn-outline justify-start gap-2"
          on:click={() => onNavigate('channels')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Channel Manager ({stats.totalChannels})
        </button>
      </div>
    </div>
  </div>

  <!-- Recent Activity -->
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body">
      <h2 class="card-title">Recent Activity</h2>

      {#if recentActivity.length === 0}
        <div class="text-center py-8 text-base-content/50">
          No recent activity
        </div>
      {:else}
        <div class="space-y-2 mt-4">
          {#each recentActivity as activity}
            <div class="flex items-center gap-3 p-3 bg-base-100 rounded-lg">
              <div class="flex-shrink-0">
                {#if activity.type === 'request'}
                  <div class="w-2 h-2 rounded-full bg-warning"></div>
                {:else}
                  <div class="w-2 h-2 rounded-full bg-success"></div>
                {/if}
              </div>

              <div class="flex-1">
                <p class="text-sm">{activity.description}</p>
              </div>

              <div class="flex-shrink-0 text-xs text-base-content/50">
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
