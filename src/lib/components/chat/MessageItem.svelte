<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { channelStore, userMemberStatus } from '$lib/stores/channelStore';
  import { getAvatarUrl } from '$lib/utils/identicon';
  import type { Message } from '$lib/types/channel';

  export let message: Message;

  const dispatch = createEventDispatcher<{ deleted: { messageId: string } }>();

  $: isOwnMessage = $authStore.publicKey === message.authorPubkey;
  $: canDelete = isOwnMessage || $userMemberStatus === 'admin';
  $: displayContent = message.isEncrypted && message.decryptedContent
    ? message.decryptedContent
    : message.content;
  $: isDecrypted = !message.isEncrypted || !!message.decryptedContent;

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  function getAuthorName(pubkey: string): string {
    if ($authStore.publicKey === pubkey) {
      return 'You';
    }
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function getAuthorAvatar(pubkey: string): string {
    // Use local identicon generation to protect user privacy
    return getAvatarUrl(pubkey, 80);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      channelStore.deleteMessage(message.channelId, message.id);
      dispatch('deleted', { messageId: message.id });
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    }
  }
</script>

<div class="flex gap-3 group {isOwnMessage ? 'flex-row-reverse' : ''}">
  <div class="avatar flex-shrink-0">
    <div class="w-10 h-10 rounded-full ring ring-base-300 ring-offset-base-100 ring-offset-1">
      <img
        src={getAuthorAvatar(message.authorPubkey)}
        alt={getAuthorName(message.authorPubkey)}
        class="object-cover"
      />
    </div>
  </div>

  <div class="flex-1 min-w-0 max-w-md">
    <div class="flex items-baseline gap-2 mb-1 {isOwnMessage ? 'flex-row-reverse' : ''}">
      <span class="font-semibold text-sm truncate">
        {getAuthorName(message.authorPubkey)}
      </span>
      <span class="text-xs text-base-content/60 flex-shrink-0">
        {formatTime(message.createdAt)}
      </span>
    </div>

    <div class="{isOwnMessage ? 'bg-primary text-primary-content' : 'bg-base-200'} rounded-2xl px-4 py-2 break-words">
      {#if message.isEncrypted && !isDecrypted}
        <div class="flex items-center gap-2 text-sm opacity-70">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
          </svg>
          <span class="italic">Encrypted message</span>
        </div>
      {:else}
        <p class="whitespace-pre-wrap">{displayContent}</p>
      {/if}

      {#if message.isEncrypted && isDecrypted}
        <div class="flex items-center gap-1 mt-1 text-xs opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
          </svg>
          <span>Encrypted</span>
        </div>
      {/if}
    </div>

    {#if canDelete}
      <button
        class="btn btn-ghost btn-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        on:click={handleDelete}
        aria-label="Delete message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        Delete
      </button>
    {/if}
  </div>
</div>
