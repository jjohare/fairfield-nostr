<script lang="ts">
  import { muteStore, mutedUsersList } from '$lib/stores/mute';
  import { nip19 } from 'nostr-tools';
  import { goto } from '$app/navigation';
  import { getAvatarUrl } from '$lib/utils/identicon';

  $: mutedUsers = $mutedUsersList;

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  function formatPubkey(pubkey: string): string {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  }

  function getNpub(pubkey: string): string {
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return pubkey;
    }
  }

  function handleUnmute(pubkey: string) {
    if (confirm('Are you sure you want to unmute this user?')) {
      muteStore.unmuteUser(pubkey);
    }
  }

  function handleClearAll() {
    if (confirm('Are you sure you want to unmute all users?')) {
      muteStore.clearAllMutes();
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function goBack() {
    window.history.back();
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="mb-6">
    <div class="flex items-center gap-4 mb-4">
      <button class="btn btn-ghost btn-sm" on:click={goBack}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        Back
      </button>
      <h1 class="text-3xl font-bold flex-1">Muted Users</h1>
    </div>

    <div class="flex items-center justify-between bg-base-200 rounded-lg p-4">
      <div>
        <p class="text-lg font-semibold">
          {mutedUsers.length} {mutedUsers.length === 1 ? 'user' : 'users'} muted
        </p>
        <p class="text-sm text-base-content/60">
          You won't see messages, DMs, or notifications from muted users
        </p>
      </div>

      {#if mutedUsers.length > 0}
        <button class="btn btn-error btn-sm" on:click={handleClearAll}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          Clear All
        </button>
      {/if}
    </div>
  </div>

  {#if mutedUsers.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
      <h2 class="text-2xl font-bold mb-2">No muted users</h2>
      <p class="text-base-content/60">
        When you mute someone, they'll appear here
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each mutedUsers as user (user.pubkey)}
        <div class="card bg-base-200 shadow-sm">
          <div class="card-body p-4">
            <div class="flex items-start gap-4">
              <div class="avatar">
                <div class="w-12 h-12 rounded-full ring ring-base-300 ring-offset-base-100 ring-offset-2">
                  <img
                    src={getAvatarUrl(user.pubkey, 48)}
                    alt={formatPubkey(user.pubkey)}
                  />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold truncate">
                    {formatPubkey(user.pubkey)}
                  </span>
                  <span class="badge badge-sm badge-error">Muted</span>
                </div>

                <div class="text-sm text-base-content/60 mb-2">
                  Muted {formatDate(user.mutedAt)}
                </div>

                {#if user.reason}
                  <div class="text-sm bg-base-100 rounded p-2 mb-2">
                    <span class="font-medium">Reason:</span> {user.reason}
                  </div>
                {/if}

                <div class="flex items-center gap-2 bg-base-100 rounded p-2">
                  <code class="text-xs flex-1 truncate">{getNpub(user.pubkey)}</code>
                  <button
                    class="btn btn-ghost btn-xs"
                    on:click={() => copyToClipboard(getNpub(user.pubkey))}
                    aria-label="Copy npub"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex-shrink-0">
                <button
                  class="btn btn-sm btn-primary"
                  on:click={() => handleUnmute(user.pubkey)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                  </svg>
                  Unmute
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
