<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { bookmarkStore } from '$lib/stores/bookmarks';
  import { channelStore } from '$lib/stores/channelStore';
  import { authStore } from '$lib/stores/auth';
  import { getAvatarUrl } from '$lib/utils/identicon';

  const dispatch = createEventDispatcher<{ close: void; navigate: { channelId: string; messageId: string } }>();

  $: bookmarks = bookmarkStore.getBookmarks();

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function getAuthorName(pubkey: string): string {
    if ($authStore.publicKey === pubkey) {
      return 'You';
    }
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function getAuthorAvatar(pubkey: string): string {
    return getAvatarUrl(pubkey, 48);
  }

  function handleNavigate(channelId: string, messageId: string) {
    dispatch('navigate', { channelId, messageId });
    dispatch('close');
  }

  function handleRemoveBookmark(messageId: string) {
    if (confirm('Remove this bookmark?')) {
      bookmarkStore.removeBookmark(messageId);
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function getChannelName(channelId: string, savedName?: string): string {
    if (savedName) return savedName;

    const channel = $channelStore.channels.find(c => c.id === channelId);
    return channel?.name || 'Unknown Channel';
  }
</script>

<div class="modal modal-open">
  <div class="modal-box max-w-3xl max-h-[80vh]">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-lg">Bookmarked Messages</h3>
      <button
        class="btn btn-sm btn-circle btn-ghost"
        on:click={handleClose}
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {#if bookmarks.length === 0}
      <div class="text-center py-12 text-base-content/60">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p class="text-lg">No bookmarks yet</p>
        <p class="text-sm mt-2">Click the bookmark icon on any message to save it here</p>
      </div>
    {:else}
      <div class="space-y-3 overflow-y-auto max-h-[60vh]">
        {#each bookmarks as bookmark (bookmark.messageId)}
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <div class="flex items-start gap-3">
                <div class="avatar flex-shrink-0">
                  <div class="w-10 h-10 rounded-full ring ring-base-300 ring-offset-base-100 ring-offset-1">
                    <img
                      src={getAuthorAvatar(bookmark.authorPubkey)}
                      alt={getAuthorName(bookmark.authorPubkey)}
                      class="object-cover"
                    />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2 mb-1">
                    <span class="font-semibold text-sm truncate">
                      {getAuthorName(bookmark.authorPubkey)}
                    </span>
                    <span class="text-xs text-base-content/60">
                      {formatTime(bookmark.timestamp)}
                    </span>
                  </div>

                  <div class="badge badge-sm badge-ghost mb-2">
                    # {getChannelName(bookmark.channelId, bookmark.channelName)}
                  </div>

                  <p class="text-sm whitespace-pre-wrap line-clamp-3 mb-3">
                    {bookmark.content}
                  </p>

                  <div class="flex gap-2">
                    <button
                      class="btn btn-xs btn-primary"
                      on:click={() => handleNavigate(bookmark.channelId, bookmark.messageId)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Go to message
                    </button>
                    <button
                      class="btn btn-xs btn-ghost btn-error"
                      on:click={() => handleRemoveBookmark(bookmark.messageId)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn" on:click={handleClose}>Close</button>
    </div>
  </div>
  <div class="modal-backdrop bg-base-300/50" on:click={handleClose}></div>
</div>

<style>
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
