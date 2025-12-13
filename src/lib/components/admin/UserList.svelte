<script lang="ts">
  import { adminStore, type User } from '$lib/stores/admin';
  import { createEventDispatcher } from 'svelte';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  const dispatch = createEventDispatcher<{
    viewProfile: { user: User };
    kickFromChannel: { user: User; channelId: string };
    banUser: { user: User };
    unbanUser: { user: User };
  }>();

  let filterCohort = '';
  let searchQuery = '';
  let sortBy: 'name' | 'lastSeen' | 'joinedAt' = 'lastSeen';
  let sortDesc = true;
  let showBannedOnly = false;
  let userToBan: User | null = null;

  $: cohorts = Array.from(
    new Set($adminStore.users.flatMap(u => u.cohorts))
  ).sort();

  $: filteredUsers = $adminStore.users
    .filter(user => {
      if (showBannedOnly && !user.isBanned) return false;
      if (!showBannedOnly && user.isBanned) return false;
      if (filterCohort && !user.cohorts.includes(filterCohort)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = user.name?.toLowerCase() || '';
        const pubkey = user.pubkey.toLowerCase();
        if (!name.includes(query) && !pubkey.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        const nameA = a.name || a.pubkey;
        const nameB = b.name || b.pubkey;
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === 'lastSeen') {
        comparison = (b.lastSeen || 0) - (a.lastSeen || 0);
      } else {
        comparison = b.joinedAt - a.joinedAt;
      }
      return sortDesc ? comparison : -comparison;
    });

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString();
  }

  function formatRelativeTime(ts: number): string {
    const now = Date.now() / 1000;
    const diff = now - ts;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatTimestamp(ts);
  }

  function handleBanUser(user: User) {
    userToBan = user;
    (document.getElementById('ban_modal') as HTMLDialogElement)?.showModal();
  }

  function confirmBan() {
    if (userToBan) {
      dispatch('banUser', { user: userToBan });
      userToBan = null;
    }
    (document.getElementById('ban_modal') as HTMLDialogElement)?.close();
  }

  function cancelBan() {
    userToBan = null;
    (document.getElementById('ban_modal') as HTMLDialogElement)?.close();
  }
</script>

<div class="p-6 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">User Management</h1>
      <p class="text-base-content/70 mt-1">
        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        {#if filterCohort || searchQuery || showBannedOnly}
          (filtered)
        {/if}
      </p>
    </div>

    <div class="form-control">
      <label class="label cursor-pointer gap-2">
        <span class="label-text">Show banned only</span>
        <input
          type="checkbox"
          class="toggle toggle-error"
          bind:checked={showBannedOnly}
        />
      </label>
    </div>
  </div>

  <!-- Filters -->
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input
            type="text"
            placeholder="Search by name or pubkey..."
            class="input input-bordered w-full"
            bind:value={searchQuery}
          />
        </div>

        <select
          class="select select-bordered"
          bind:value={filterCohort}
        >
          <option value="">All Cohorts</option>
          {#each cohorts as cohort}
            <option value={cohort}>{cohort}</option>
          {/each}
        </select>

        <select
          class="select select-bordered"
          bind:value={sortBy}
        >
          <option value="lastSeen">Sort by Last Seen</option>
          <option value="joinedAt">Sort by Join Date</option>
          <option value="name">Sort by Name</option>
        </select>

        <button
          class="btn btn-ghost"
          on:click={() => sortDesc = !sortDesc}
        >
          {#if sortDesc}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Users Table -->
  <div class="card bg-base-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th>User</th>
            <th>Cohorts</th>
            <th>Channels</th>
            <th>Joined</th>
            <th>Last Seen</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if $adminStore.loading.users}
            <tr>
              <td colspan="7" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>
          {:else if filteredUsers.length === 0}
            <tr>
              <td colspan="7" class="text-center py-8 text-base-content/50">
                No users found
              </td>
            </tr>
          {:else}
            {#each filteredUsers as user (user.pubkey)}
              <tr class:opacity-50={user.isBanned}>
                <td>
                  <UserDisplay
                    pubkey={user.pubkey}
                    showAvatar={true}
                    showName={true}
                    showFullName={true}
                    avatarSize="sm"
                    clickable={false}
                  />
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    {#each user.cohorts as cohort}
                      <span class="badge badge-sm badge-primary">{cohort}</span>
                    {/each}
                    {#if user.cohorts.length === 0}
                      <span class="text-xs text-base-content/50">None</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class="badge badge-ghost">{user.channels.length}</span>
                </td>
                <td>
                  <span class="text-sm">{formatTimestamp(user.joinedAt)}</span>
                </td>
                <td>
                  {#if user.lastSeen}
                    <span class="text-sm">{formatRelativeTime(user.lastSeen)}</span>
                  {:else}
                    <span class="text-xs text-base-content/50">Never</span>
                  {/if}
                </td>
                <td>
                  {#if user.isBanned}
                    <span class="badge badge-error">Banned</span>
                  {:else}
                    <span class="badge badge-success">Active</span>
                  {/if}
                </td>
                <td>
                  <div class="dropdown dropdown-end">
                    <button tabindex="0" class="btn btn-ghost btn-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 z-10">
                      <li>
                        <button on:click={() => dispatch('viewProfile', { user })}>
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          View Profile
                        </button>
                      </li>
                      {#if !user.isBanned}
                        <li>
                          <button class="text-error" on:click={() => handleBanUser(user)}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Ban User
                          </button>
                        </li>
                      {:else}
                        <li>
                          <button class="text-success" on:click={() => dispatch('unbanUser', { user })}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Unban User
                          </button>
                        </li>
                      {/if}
                    </ul>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Ban Confirmation Modal -->
  <dialog id="ban_modal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Confirm Ban</h3>
      <p class="py-4">
        Are you sure you want to ban user
        <span class="font-semibold">{userToBan?.name || truncatePubkey(userToBan?.pubkey || '')}</span>?
        This action will remove them from all channels.
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" on:click={cancelBan}>Cancel</button>
        <button class="btn btn-error" on:click={confirmBan}>Ban User</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button on:click={cancelBan}>close</button>
    </form>
  </dialog>

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
