<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore, isAdmin } from '$lib/stores/auth';

  let stats = {
    totalUsers: 0,
    totalChannels: 0,
    totalMessages: 0,
    pendingApprovals: 0
  };

  onMount(() => {
    if (!$isAdmin) {
      goto(`${base}/chat`);
      return;
    }

    // Load admin stats (placeholder)
  });
</script>

<svelte:head>
  <title>Admin Dashboard - Fairfield Nostr</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <div class="mb-6">
    <h1 class="text-4xl font-bold gradient-text mb-2">Admin Dashboard</h1>
    <p class="text-base-content/70">System overview and management</p>
  </div>

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
        <h2 class="card-title">Channel Management</h2>
        <p class="text-sm text-base-content/70">Create and moderate channels</p>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary btn-sm">Manage Channels</button>
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
