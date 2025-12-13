<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { channelStore, userMemberStatus } from '$lib/stores/channelStore';
  import { isAdmin } from '$lib/stores/user';
  import { bookmarkStore, isBookmarked } from '$lib/stores/bookmarks';
  import { pinnedStore, isPinnedMessage } from '$lib/stores/pinnedMessages';
  import type { Message } from '$lib/types/channel';
  import { extractUrls, getMediaType } from '$lib/utils/linkPreview';
  import LinkPreview from './LinkPreview.svelte';
  import MediaEmbed from './MediaEmbed.svelte';
  import { preferencesStore } from '$lib/stores/preferences';
  import { reactionStore, getMessageReactions } from '$lib/stores/reactions';
  import ReactionBar from './ReactionBar.svelte';
  import ReactionPicker from './ReactionPicker.svelte';

  export let message: Message;
  export let channelName: string | undefined = undefined;
  export let messageElement: HTMLDivElement | undefined = undefined;
  export let relayUrl: string = '';

  const dispatch = createEventDispatcher<{
    deleted: { messageId: string };
    pinned: { messageId: string };
    unpinned: { messageId: string };
    react: { messageId: string; emoji: string };
    unreact: { messageId: string };
  }>();

  let showReactionPicker = false;

  $: isOwnMessage = $authStore.publicKey === message.authorPubkey;
  $: canDelete = isOwnMessage || $userMemberStatus === 'admin';
  $: isPinned = isPinnedMessage(message.channelId, message.id);
  $: canPinMore = pinnedStore.canPinMore(message.channelId);
  $: displayContent = message.isEncrypted && message.decryptedContent
    ? message.decryptedContent
    : message.content;
  $: isDecrypted = !message.isEncrypted || !!message.decryptedContent;
  $: bookmarked = isBookmarked(message.id);

  // Extract URLs and determine media types
  $: urls = $preferencesStore.linkPreviewsEnabled && isDecrypted ? extractUrls(displayContent) : [];
  $: mediaUrls = urls.slice(0, 3).map(url => getMediaType(url));
  $: hasMedia = mediaUrls.length > 0;

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
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;
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

  function handleToggleBookmark() {
    bookmarkStore.toggleBookmark(
      message.id,
      message.channelId,
      displayContent,
      message.authorPubkey,
      message.createdAt,
      channelName
    );
  }

  function handlePin() {
    if ($isPinned) {
      if (pinnedStore.unpinMessage(message.channelId, message.id)) {
        dispatch('unpinned', { messageId: message.id });
      }
    } else {
      if (!canPinMore) {
        alert('Maximum of 5 messages can be pinned per channel');
        return;
      }
      if (pinnedStore.pinMessage(message.channelId, message.id)) {
        dispatch('pinned', { messageId: message.id });
      }
    }
  }

  async function handleReactionSelect(event: CustomEvent<{ emoji: string }>) {
    showReactionPicker = false;
    try {
      await reactionStore.addReaction(
        message.id,
        event.detail.emoji,
        relayUrl,
        message.authorPubkey
      );
      dispatch('react', { messageId: message.id, emoji: event.detail.emoji });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }

  function handleReactionBarReact(event: CustomEvent<{ emoji: string }>) {
    dispatch('react', { messageId: message.id, emoji: event.detail.emoji });
  }

  function handleReactionBarUnreact() {
    dispatch('unreact', { messageId: message.id });
  }
</script>

<div
  class="flex gap-3 group {isOwnMessage ? 'flex-row-reverse' : ''} {$isPinned ? 'bg-warning/5 -mx-2 px-2 py-1 rounded-lg' : ''}"
  bind:this={messageElement}
  id="message-{message.id}"
>
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
      {#if $isPinned}
        <div class="tooltip tooltip-top" data-tip="Pinned message">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-warning" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
        </div>
      {/if}
      <span class="text-xs text-base-content/60 flex-shrink-0">
        {formatTime(message.createdAt)}
      </span>
    </div>

    <div class="{isOwnMessage ? 'bg-primary text-primary-content' : 'bg-base-200'} rounded-2xl px-4 py-2 break-words {$isPinned ? 'ring-1 ring-warning/30' : ''}">
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

    <!-- Link previews and media embeds -->
    {#if hasMedia}
      <div class="media-container mt-2">
        {#each mediaUrls as media}
          {#if media.type === 'link'}
            <LinkPreview url={media.url} />
          {:else}
            <MediaEmbed {media} />
          {/if}
        {/each}
      </div>
    {/if}

    <div class="flex gap-2 mt-1">
      {#if $isAdmin}
        <button
          class="btn btn-ghost btn-xs {$isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity"
          on:click={handlePin}
          aria-label={$isPinned ? 'Unpin message' : 'Pin message'}
          title={$isPinned ? 'Unpin message' : 'Pin message'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 {$isPinned ? 'text-warning' : ''}"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
          {$isPinned ? 'Unpin' : 'Pin'}
        </button>
      {/if}

      <button
        class="btn btn-ghost btn-xs {$bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity"
        on:click={handleToggleBookmark}
        aria-label={$bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {#if $bookmarked}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        {/if}
        Bookmark
      </button>

      {#if canDelete}
        <button
          class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
          on:click={handleDelete}
          aria-label="Delete message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          Delete
        </button>
      {/if}

      <!-- Reaction button -->
      <div class="relative">
        <button
          class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
          on:click={() => showReactionPicker = !showReactionPicker}
          aria-label="Add reaction"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <ReactionPicker
          show={showReactionPicker}
          on:select={handleReactionSelect}
          on:close={() => showReactionPicker = false}
        />
      </div>
    </div>

    <!-- Reaction bar -->
    <ReactionBar
      messageId={message.id}
      {relayUrl}
      authorPubkey={message.authorPubkey}
      on:react={handleReactionBarReact}
      on:unreact={handleReactionBarUnreact}
    />
  </div>
</div>
