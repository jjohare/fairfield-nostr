<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte';
  import { selectedMessages, selectedChannel } from '$lib/stores/channelStore';
  import { messageStore } from '$lib/stores/messages';
  import { authStore } from '$lib/stores/auth';
  import { getActiveRelays } from '$lib/stores/settings';
  import { toast } from '$lib/stores/toast';
  import MessageItem from './MessageItem.svelte';
  import type { Message } from '$lib/types/channel';

  let messagesContainer: HTMLDivElement;
  let autoScroll = true;
  let isLoadingMore = false;
  let hasMoreMessages = true;

  $: messages = $selectedMessages;

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
    const previousScrollHeight = messagesContainer?.scrollHeight || 0;

    try {
      const relayUrls = getActiveRelays();
      const relayUrl = relayUrls[0];

      if (!relayUrl) {
        toast.warning('No relay configured');
        hasMoreMessages = false;
        return;
      }

      const foundMore = await messageStore.fetchOlderMessages(
        relayUrl,
        $selectedChannel.id,
        $authStore.privateKey,
        30
      );

      hasMoreMessages = foundMore;

      // Maintain scroll position after loading older messages
      if (messagesContainer && foundMore) {
        await tick();
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - previousScrollHeight;
      }

    } catch (error) {
      console.error('Failed to load more messages:', error);
      toast.error('Failed to load older messages');
      hasMoreMessages = false;
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
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p class="text-lg font-medium">No messages yet</p>
        <p class="text-sm mt-1">Be the first to start the conversation</p>
      </div>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <MessageItem
        {message}
        on:deleted={handleMessageDeleted}
      />
    {/each}
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
