<script lang="ts">
  import { adminStore, type Channel } from '$lib/stores/admin';
  import { createEventDispatcher } from 'svelte';
  import { SECTION_CONFIG, type ChannelSection } from '$lib/types/channel';

  const dispatch = createEventDispatcher<{
    createChannel: { channel: Omit<Channel, 'id' | 'createdAt' | 'memberCount' | 'creatorPubkey'> };
    editChannel: { channelId: string; updates: Partial<Channel> };
    deleteChannel: { channelId: string };
    viewMembers: { channelId: string };
  }>();

  let showCreateForm = false;
  let editingChannel: Channel | null = null;
  let channelToDelete: Channel | null = null;

  // Form fields
  let formName = '';
  let formDescription = '';
  let formCohorts = '';
  let formVisibility: 'public' | 'cohort' | 'private' = 'public';
  let formEncrypted = false;
  let formSection: ChannelSection = 'fairfield-guests';

  let filterVisibility = '';
  let searchQuery = '';
  let sortBy: 'name' | 'createdAt' | 'memberCount' = 'createdAt';
  let sortDesc = true;

  $: filteredChannels = $adminStore.channels
    .filter(channel => {
      if (filterVisibility && channel.visibility !== filterVisibility) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = channel.name.toLowerCase();
        const desc = channel.description?.toLowerCase() || '';
        if (!name.includes(query) && !desc.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = b.createdAt - a.createdAt;
      } else {
        comparison = b.memberCount - a.memberCount;
      }
      return sortDesc ? comparison : -comparison;
    });

  function resetForm() {
    formName = '';
    formDescription = '';
    formCohorts = '';
    formVisibility = 'public';
    formEncrypted = false;
    formSection = 'fairfield-guests';
    editingChannel = null;
  }

  function handleCreate() {
    if (!formName.trim()) return;

    dispatch('createChannel', {
      channel: {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        cohorts: formCohorts.split(',').map(c => c.trim()).filter(Boolean),
        visibility: formVisibility,
        encrypted: formEncrypted,
        section: formSection,
      }
    });

    resetForm();
    showCreateForm = false;
  }

  function handleEdit(channel: Channel) {
    editingChannel = channel;
    formName = channel.name;
    formDescription = channel.description || '';
    formCohorts = channel.cohorts.join(', ');
    formVisibility = channel.visibility;
    formEncrypted = channel.encrypted;
    formSection = channel.section || 'fairfield-guests';
    showCreateForm = true;
  }

  function handleUpdate() {
    if (!editingChannel || !formName.trim()) return;

    dispatch('editChannel', {
      channelId: editingChannel.id,
      updates: {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        cohorts: formCohorts.split(',').map(c => c.trim()).filter(Boolean),
        visibility: formVisibility,
        encrypted: formEncrypted,
        section: formSection,
      }
    });

    resetForm();
    showCreateForm = false;
  }

  function handleDeleteClick(channel: Channel) {
    channelToDelete = channel;
    (document.getElementById('delete_modal') as HTMLDialogElement)?.showModal();
  }

  function confirmDelete() {
    if (channelToDelete) {
      dispatch('deleteChannel', { channelId: channelToDelete.id });
      channelToDelete = null;
    }
    (document.getElementById('delete_modal') as HTMLDialogElement)?.close();
  }

  function cancelDelete() {
    channelToDelete = null;
    (document.getElementById('delete_modal') as HTMLDialogElement)?.close();
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString();
  }

  function getVisibilityBadge(visibility: string) {
    const badges = {
      public: 'badge-success',
      cohort: 'badge-warning',
      private: 'badge-error',
    };
    return badges[visibility as keyof typeof badges] || 'badge-ghost';
  }
</script>

<div class="p-6 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Channel Management</h1>
      <p class="text-base-content/70 mt-1">
        {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''}
      </p>
    </div>

    <button
      class="btn btn-primary gap-2"
      on:click={() => { resetForm(); showCreateForm = !showCreateForm; }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Create Channel
    </button>
  </div>

  <!-- Create/Edit Form -->
  {#if showCreateForm}
    <div class="card bg-base-200 shadow-sm">
      <div class="card-body">
        <h2 class="card-title">
          {editingChannel ? 'Edit Channel' : 'Create New Channel'}
        </h2>

        <div class="form-control">
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

        <div class="form-control">
          <label class="label">
            <span class="label-text">Description</span>
          </label>
          <textarea
            class="textarea textarea-bordered"
            placeholder="Channel description (optional)"
            rows="3"
            bind:value={formDescription}
          ></textarea>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Section (Area)</span>
          </label>
          <select class="select select-bordered" bind:value={formSection}>
            {#each Object.entries(SECTION_CONFIG) as [key, config]}
              <option value={key}>{config.icon} {config.name}</option>
            {/each}
          </select>
          <label class="label">
            <span class="label-text-alt text-base-content/60">
              {SECTION_CONFIG[formSection]?.description || ''}
            </span>
          </label>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Cohorts (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., 2024, 2025, Alumni"
            class="input input-bordered"
            bind:value={formCohorts}
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Visibility</span>
            </label>
            <select class="select select-bordered" bind:value={formVisibility}>
              <option value="public">Public (Anyone can see)</option>
              <option value="cohort">Cohort (Cohort members only)</option>
              <option value="private">Private (Invite only)</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Encrypted Messages</span>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                bind:checked={formEncrypted}
              />
            </label>
          </div>
        </div>

        <div class="card-actions justify-end gap-2 mt-4">
          <button class="btn btn-ghost" on:click={() => { resetForm(); showCreateForm = false; }}>
            Cancel
          </button>
          {#if editingChannel}
            <button class="btn btn-primary" on:click={handleUpdate}>
              Update Channel
            </button>
          {:else}
            <button class="btn btn-primary" on:click={handleCreate}>
              Create Channel
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input
            type="text"
            placeholder="Search channels..."
            class="input input-bordered w-full"
            bind:value={searchQuery}
          />
        </div>

        <select
          class="select select-bordered"
          bind:value={filterVisibility}
        >
          <option value="">All Visibility Levels</option>
          <option value="public">Public</option>
          <option value="cohort">Cohort</option>
          <option value="private">Private</option>
        </select>

        <select
          class="select select-bordered"
          bind:value={sortBy}
        >
          <option value="createdAt">Sort by Created</option>
          <option value="name">Sort by Name</option>
          <option value="memberCount">Sort by Members</option>
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

  <!-- Channels Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#if $adminStore.loading.channels}
      <div class="col-span-full text-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {:else if filteredChannels.length === 0}
      <div class="col-span-full text-center py-8 text-base-content/50">
        No channels found
      </div>
    {:else}
      {#each filteredChannels as channel (channel.id)}
        <div class="card bg-base-200 shadow-sm">
          <div class="card-body">
            <div class="flex items-start justify-between">
              <h3 class="card-title text-lg">{channel.name}</h3>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-ghost btn-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-44 z-10">
                  <li><button on:click={() => handleEdit(channel)}>Edit</button></li>
                  <li><button on:click={() => dispatch('viewMembers', { channelId: channel.id })}>View Members</button></li>
                  <li><button class="text-error" on:click={() => handleDeleteClick(channel)}>Delete</button></li>
                </ul>
              </div>
            </div>

            {#if channel.description}
              <p class="text-sm text-base-content/70 line-clamp-2">{channel.description}</p>
            {/if}

            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge badge-neutral" title="Section">
                {SECTION_CONFIG[channel.section]?.icon || '👋'} {SECTION_CONFIG[channel.section]?.name || 'Guest Area'}
              </span>
              <span class="badge {getVisibilityBadge(channel.visibility)}">
                {channel.visibility}
              </span>
              {#if channel.encrypted}
                <span class="badge badge-info">Encrypted</span>
              {/if}
              {#each channel.cohorts as cohort}
                <span class="badge badge-outline">{cohort}</span>
              {/each}
            </div>

            <div class="divider my-2"></div>

            <div class="flex justify-between text-sm text-base-content/70">
              <span>{channel.memberCount} member{channel.memberCount !== 1 ? 's' : ''}</span>
              <span>Created {formatTimestamp(channel.createdAt)}</span>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Delete Confirmation Modal -->
  <dialog id="delete_modal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Confirm Delete</h3>
      <p class="py-4">
        Are you sure you want to delete channel
        <span class="font-semibold">{channelToDelete?.name}</span>?
        This action cannot be undone and will remove all messages.
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" on:click={cancelDelete}>Cancel</button>
        <button class="btn btn-error" on:click={confirmDelete}>Delete Channel</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button on:click={cancelDelete}>close</button>
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
