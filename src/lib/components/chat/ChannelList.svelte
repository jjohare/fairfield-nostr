<script lang="ts">
  import { channelStore, selectedChannel } from '$lib/stores/channelStore';
  import { authStore } from '$lib/stores/auth';
  import { draftStore } from '$lib/stores/drafts';
  import { lastReadStore } from '$lib/stores/readPosition';
  import { formatUnreadCount } from '$lib/utils/readPosition';
  import DraftIndicator from './DraftIndicator.svelte';
  import type { Channel, MemberStatus } from '$lib/types/channel';

  export let cohortFilter: string[] = [];

  $: readPositions = $lastReadStore;

  let filteredChannels: Channel[] = [];
  let draftChannels: Set<string> = new Set();

  $: {
    filteredChannels = $channelStore.channels.filter(channel => {
      if (cohortFilter.length === 0) return true;
      return channel.cohortTags.some(tag => cohortFilter.includes(tag));
    });

    // Update draft channels set
    const channels = draftStore.getDraftChannels();
    draftChannels = new Set(channels);
  }

  function getMemberStatus(channel: Channel): MemberStatus {
    if (!$authStore.publicKey) return 'non-member';
    return channelStore.getMemberStatus(channel.id, $authStore.publicKey);
  }

  function getStatusBadgeClass(status: MemberStatus): string {
    switch (status) {
      case 'admin':
        return 'badge-primary';
      case 'member':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      default:
        return 'badge-ghost';
    }
  }

  function getStatusText(status: MemberStatus): string {
    switch (status) {
      case 'admin':
        return 'Admin';
      case 'member':
        return 'Member';
      case 'pending':
        return 'Pending';
      default:
        return 'Join';
    }
  }

  function selectChannel(channel: Channel) {
    channelStore.selectChannel(channel.id);
  }

  function truncateDescription(description: string, maxLength: number = 60): string {
    if (description.length <= maxLength) return description;
    return description.slice(0, maxLength) + '...';
  }

  function getUnreadCount(channel: Channel): number {
    const messages = $channelStore.messages[channel.id] || [];
    return lastReadStore.getUnreadCount(channel.id, messages);
  }
</script>

<div class="flex flex-col h-full bg-base-100">
  <div class="p-4 border-b border-base-300">
    <h2 class="text-2xl font-bold">Channels</h2>
    {#if cohortFilter.length > 0}
      <div class="flex flex-wrap gap-1 mt-2">
        {#each cohortFilter as tag}
          <span class="badge badge-sm badge-outline">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto">
    {#if filteredChannels.length === 0}
      <div class="flex items-center justify-center h-full p-8 text-center">
        <div class="text-base-content/60">
          {#if cohortFilter.length > 0}
            <p>No channels found for selected cohorts</p>
          {:else}
            <p>No channels available</p>
          {/if}
        </div>
      </div>
    {:else}
      <div class="divide-y divide-base-300">
        {#each filteredChannels as channel (channel.id)}
          {@const status = getMemberStatus(channel)}
          {@const isSelected = $selectedChannel?.id === channel.id}
          {@const unreadCount = getUnreadCount(channel)}
          <button
            class="w-full text-left p-4 hover:bg-base-200 transition-colors {isSelected ? 'bg-base-200' : ''}"
            on:click={() => selectChannel(channel)}
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-base truncate">{channel.name}</h3>
                  {#if channel.isEncrypted}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                    </svg>
                  {/if}
                  {#if draftChannels.has(channel.id)}
                    {@const draftPreview = draftStore.getDraftPreview(channel.id)}
                    {#if draftPreview}
                      <DraftIndicator draftPreview={draftPreview} tooltipPosition="right" />
                    {/if}
                  {/if}
                  {#if unreadCount > 0}
                    <span class="badge badge-primary badge-sm rounded-full">
                      {formatUnreadCount(unreadCount)}
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-base-content/70 line-clamp-2">
                  {truncateDescription(channel.description)}
                </p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-xs text-base-content/60 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    {channel.members.length}
                  </span>
                  {#if channel.cohortTags.length > 0}
                    <div class="flex flex-wrap gap-1">
                      {#each channel.cohortTags.slice(0, 2) as tag}
                        <span class="badge badge-xs badge-outline">{tag}</span>
                      {/each}
                      {#if channel.cohortTags.length > 2}
                        <span class="badge badge-xs">+{channel.cohortTags.length - 2}</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex-shrink-0">
                <span class="badge badge-sm {getStatusBadgeClass(status)}">
                  {getStatusText(status)}
                </span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
