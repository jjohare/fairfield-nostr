<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isAdmin } from '$lib/stores/user';
  import { pinnedStore, getPinnedForChannel } from '$lib/stores/pinnedMessages';
  import type { Message } from '$lib/types/channel';

  export let channelId: string;
  export let messages: Message[];

  const dispatch = createEventDispatcher<{
    scrollTo: { messageId: string };
    unpin: { messageId: string };
  }>();

  let isExpanded = true;

  $: pinnedMessageIds = getPinnedForChannel(channelId);
  $: pinnedMessages = messages.filter(msg => $pinnedMessageIds.includes(msg.id));
  $: hasPinnedMessages = pinnedMessages.length > 0;

  function handleUnpin(messageId: string) {
    if (pinnedStore.unpinMessage(channelId, messageId)) {
      dispatch('unpin', { messageId });
    }
  }

  function handleScrollTo(messageId: string) {
    dispatch('scrollTo', { messageId });
  }

  function getAuthorName(pubkey: string): string {
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function truncateContent(content: string, maxLength: number = 80): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
</script>

{#if hasPinnedMessages}
  <div class="bg-base-200 border-b border-base-300">
    <div class="container mx-auto max-w-4xl">
      <div class="collapse collapse-arrow" class:collapse-open={isExpanded} class:collapse-close={!isExpanded}>
        <input
          type="checkbox"
          bind:checked={isExpanded}
          class="min-h-0"
        />
        <div class="collapse-title min-h-0 py-3 px-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
          <span class="font-semibold text-sm">
            Pinned Messages ({pinnedMessages.length})
          </span>
        </div>

        <div class="collapse-content px-4 pb-3 pt-0">
          <div class="space-y-2">
            {#each pinnedMessages as message (message.id)}
              <div
                class="bg-base-100 rounded-lg p-3 border border-warning/20 hover:border-warning/40 transition-colors cursor-pointer group"
                on:click={() => handleScrollTo(message.id)}
                on:keypress={(e) => e.key === 'Enter' && handleScrollTo(message.id)}
                role="button"
                tabindex="0"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-warning" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2 mb-1">
                      <span class="font-semibold text-sm">
                        {getAuthorName(message.authorPubkey)}
                      </span>
                      <span class="text-xs text-base-content/60">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>

                    <p class="text-sm text-base-content/80 break-words">
                      {#if message.isEncrypted && message.decryptedContent}
                        {truncateContent(message.decryptedContent)}
                      {:else if !message.isEncrypted}
                        {truncateContent(message.content)}
                      {:else}
                        <span class="italic opacity-70">Encrypted message</span>
                      {/if}
                    </p>
                  </div>

                  {#if $isAdmin}
                    <button
                      class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      on:click|stopPropagation={() => handleUnpin(message.id)}
                      aria-label="Unpin message"
                      title="Unpin message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .collapse-title {
    cursor: pointer;
    user-select: none;
  }
</style>
