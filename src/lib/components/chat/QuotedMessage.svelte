<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Message } from '$lib/types/channel';
  import { authStore } from '$lib/stores/auth';

  export let message: Message;
  export let compact: boolean = false;
  export let showTimestamp: boolean = true;

  const dispatch = createEventDispatcher<{ click: { messageId: string } }>();

  $: displayContent = message.isEncrypted && message.decryptedContent
    ? message.decryptedContent
    : message.content;

  function getAuthorName(pubkey: string): string {
    if ($authStore.publicKey === pubkey) {
      return 'You';
    }
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  }

  function handleClick() {
    dispatch('click', { messageId: message.id });
  }
</script>

<div
  class="quoted-message border-l-4 border-primary/40 bg-base-200/50 rounded-r-lg p-2 {compact ? 'text-xs' : 'text-sm'} cursor-pointer hover:bg-base-200 transition-colors"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
>
  <div class="flex items-start gap-2">
    <div class="flex-shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-primary/60"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 mb-1">
        <span class="font-semibold text-primary/80 truncate">
          {getAuthorName(message.authorPubkey)}
        </span>
        {#if showTimestamp}
          <span class="text-xs text-base-content/50 flex-shrink-0">
            {formatTime(message.createdAt)}
          </span>
        {/if}
      </div>

      <div class="text-base-content/70 break-words">
        {#if compact}
          <p class="line-clamp-2">{truncateContent(displayContent, 150)}</p>
        {:else}
          <p class="whitespace-pre-wrap">{displayContent}</p>
        {/if}
      </div>

      {#if message.isEncrypted}
        <div class="flex items-center gap-1 mt-1 text-xs opacity-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clip-rule="evenodd"
            />
          </svg>
          <span>Encrypted</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .quoted-message {
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
