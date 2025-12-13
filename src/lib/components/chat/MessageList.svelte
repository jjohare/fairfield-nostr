<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte';
  import { selectedMessages, selectedChannel } from '$lib/stores/channelStore';
  import MessageItem from './MessageItem.svelte';
  import type { Message } from '$lib/types/channel';
  import { filterMessages, highlightMatch } from '$lib/utils/search';
  import type { SearchFilters } from '$lib/utils/search';
  import { muteStore } from '$lib/stores/mute';

  export let searchQuery = '';
  export let searchFilters: SearchFilters = { scope: 'all' };
  export let currentUserPubkey: string | undefined = undefined;

  let messagesContainer: HTMLDivElement;
  let autoScroll = true;
  let isLoadingMore = false;
  let hasMoreMessages = true;
  let showMutedMessages = false;

  $: allMessages = $selectedMessages;
  $: searchFilteredMessages = filterMessages(allMessages, searchQuery, searchFilters, currentUserPubkey);
  $: messages = showMutedMessages ? searchFilteredMessages : searchFilteredMessages.filter(msg => !muteStore.isMuted(msg.authorPubkey));
  $: mutedMessageCount = searchFilteredMessages.length - messages.length;
  $: isFiltering = searchQuery.trim() !== '' || searchFilters.scope !== 'all' || searchFilters.dateFrom || searchFilters.dateTo;

  onMount(() => {
    if (messagesContainer) {
      scrollToBottom();
    }
  });

  afterUpdate(() => {
    if (autoScroll && messagesContainer) {
      scrollToBottom();
    }
  });

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function handleScroll() {
    if (!messagesContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    autoScroll = distanceFromBottom < 100;

    if (scrollTop < 100 && !isLoadingMore && hasMoreMessages) {
      loadMoreMessages();
    }
  }

  async function loadMoreMessages() {
    if (!$selectedChannel || isLoadingMore) return;

    isLoadingMore = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      hasMoreMessages = false;
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      isLoadingMore = false;
    }
  }

  function handleMessageDeleted(event: CustomEvent<{ messageId: string }>) {
    console.log('Message deleted:', event.detail.messageId);
  }
</script>

<div
  class="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100"
  bind:this={messagesContainer}
  on:scroll={handleScroll}
>
  {#if isLoadingMore}
    <div class="flex justify-center py-2">
      <span class="loading loading-spinner loading-sm"></span>
    </div>
  {/if}

  {#if messages.length === 0}
    <div class="flex items-center justify-center h-full">
      <div class="text-center text-base-content/60">
        {#if isFiltering}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p class="text-lg font-medium">No messages found</p>
          <p class="text-sm mt-1">Try adjusting your search or filters</p>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p class="text-lg font-medium">No messages yet</p>
          <p class="text-sm mt-1">Be the first to start the conversation</p>
        {/if}
      </div>
    </div>
  {:else}
    {#if isFiltering}
      <div class="mb-4 text-sm text-base-content/60">
        Showing {messages.length} of {allMessages.length} messages
      </div>
    {/if}
    {#each messages as message (message.id)}
      <MessageItem
        {message}
        channelName={$selectedChannel?.name}
        searchQuery={isFiltering ? searchQuery : ''}
        on:deleted={handleMessageDeleted}
      />
    {/each}

    {#if mutedMessageCount > 0}
      <div class="flex justify-center my-4">
        <button
          class="btn btn-ghost btn-sm gap-2"
          on:click={() => showMutedMessages = !showMutedMessages}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
          {showMutedMessages ? 'Hide' : 'Show'} {mutedMessageCount} hidden {mutedMessageCount === 1 ? 'message' : 'messages'}
        </button>
      </div>
    {/if}
  {/if}

  {#if !autoScroll}
    <button
      class="btn btn-circle btn-sm btn-primary fixed bottom-24 right-6 shadow-lg"
      on:click={scrollToBottom}
      aria-label="Scroll to bottom"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    </button>
  {/if}
</div>
