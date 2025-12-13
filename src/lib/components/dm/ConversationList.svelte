<script lang="ts">
  import { sortedConversations, dmStore } from '$lib/stores/dm';
  import { draftStore } from '$lib/stores/drafts';
  import DraftIndicator from '../chat/DraftIndicator.svelte';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';
  import type { DMConversation } from '$lib/stores/dm';

  let draftConversations: Set<string> = new Set();

  // Update draft conversations whenever sorted conversations change
  $: {
    const channels = draftStore.getDraftChannels();
    draftConversations = new Set(channels);
  }

  /**
   * Handle conversation click
   */
  function handleConversationClick(conversation: DMConversation) {
    dmStore.selectConversation(conversation.pubkey);
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp: number): string {
    if (timestamp === 0) return '';

    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

</script>

<div class="flex flex-col h-full bg-base-100">
  <!-- Header -->
  <div class="p-4 border-b border-base-300">
    <h2 class="text-xl font-bold">Messages</h2>
  </div>

  <!-- Conversation List -->
  <div class="flex-1 overflow-y-auto">
    {#if $sortedConversations.length === 0}
      <div class="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-16 h-16 mb-4 text-base-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p class="text-base-content/60 text-sm">No conversations yet</p>
        <p class="text-base-content/40 text-xs mt-2">Start a new message to begin</p>
      </div>
    {:else}
      <div class="divide-y divide-base-300">
        {#each $sortedConversations as conversation (conversation.pubkey)}
          <button
            class="w-full p-4 hover:bg-base-200 active:bg-base-300 transition-colors flex items-center gap-3 text-left"
            on:click={() => handleConversationClick(conversation)}
          >
            <!-- User Display -->
            <UserDisplay
              pubkey={conversation.pubkey}
              showAvatar={true}
              showName={false}
              avatarSize="md"
              clickable={false}
            />

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <UserDisplay
                    pubkey={conversation.pubkey}
                    showAvatar={false}
                    showName={true}
                    showFullName={true}
                    clickable={false}
                    maxNameLength={25}
                  />
                  {#if draftConversations.has(conversation.pubkey)}
                    {@const draftPreview = draftStore.getDraftPreview(conversation.pubkey)}
                    {#if draftPreview}
                      <DraftIndicator draftPreview={draftPreview} tooltipPosition="right" />
                    {/if}
                  {/if}
                </div>
                {#if conversation.lastMessageTimestamp > 0}
                  <span class="text-xs text-base-content/60 flex-shrink-0">
                    {formatTimestamp(conversation.lastMessageTimestamp)}
                  </span>
                {/if}
              </div>

              <div class="flex items-center justify-between gap-2">
                <p class="text-sm text-base-content/70 truncate">
                  {conversation.lastMessage || 'No messages yet'}
                </p>
                {#if conversation.unreadCount > 0}
                  <div class="badge badge-primary badge-sm flex-shrink-0">
                    {conversation.unreadCount}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Pin indicator -->
            {#if conversation.isPinned}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 text-base-content/40 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1h-2zM9 4.323V3a1 1 0 00-1-1 1 1 0 00-1 1v1.323l-3.954 1.582-1.599-.8a1 1 0 00-.894 1.79l1.233.616-1.738 5.42a1 1 0 00.285 1.05A3.989 3.989 0 005 15a3.989 3.989 0 002.667-1.019 1 1 0 00.285-1.05l-1.738-5.42 1.233-.617a1 1 0 00-.894-1.788l-1.599.799L9 4.323z"
                />
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Ensure smooth scrolling */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
</style>
