<script lang="ts">
  import { mutedConversations } from '$lib/stores/dm';
  import { muteStore } from '$lib/stores/mute';
  import { goto } from '$app/navigation';
  import { getAvatarUrl } from '$lib/utils/identicon';

  $: conversations = $mutedConversations;

  let showMuted = false;

  function toggleShow() {
    showMuted = !showMuted;
  }

  function handleUnmute(pubkey: string) {
    if (confirm('Unmute this user to see their messages again?')) {
      muteStore.unmuteUser(pubkey);
    }
  }

  function getAvatar(pubkey: string): string {
    return getAvatarUrl(pubkey, 48);
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? 'Yesterday' : `${diffInDays}d ago`;
    }
  }
</script>

{#if conversations.length > 0}
  <div class="border-t border-base-300">
    <button
      class="w-full p-4 flex items-center justify-between hover:bg-base-200 transition-colors"
      on:click={toggleShow}
    >
      <div class="flex items-center gap-2 text-sm text-base-content/60">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
        </svg>
        <span class="font-medium">
          Muted Conversations ({conversations.length})
        </span>
      </div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 transition-transform {showMuted ? 'rotate-180' : ''}"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    {#if showMuted}
      <div class="bg-base-100 border-t border-base-300">
        {#each conversations as conversation (conversation.pubkey)}
          <div class="flex items-center gap-3 p-4 hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0">
            <div class="avatar">
              <div class="w-12 h-12 rounded-full opacity-50">
                <img src={getAvatar(conversation.pubkey)} alt={conversation.name} />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold truncate text-base-content/60">
                  {conversation.name}
                </span>
                <span class="badge badge-xs badge-error">Muted</span>
              </div>

              <p class="text-sm text-base-content/40 truncate">
                {conversation.lastMessage || 'No messages'}
              </p>

              {#if conversation.lastMessageTimestamp}
                <p class="text-xs text-base-content/40 mt-1">
                  {formatTime(conversation.lastMessageTimestamp)}
                </p>
              {/if}
            </div>

            <button
              class="btn btn-ghost btn-xs"
              on:click={() => handleUnmute(conversation.pubkey)}
              aria-label="Unmute conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
