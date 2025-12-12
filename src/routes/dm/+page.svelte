<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';

  let conversations: any[] = [];
  let loading = true;

  onMount(async () => {
    if (!$authStore.isAuthenticated) {
      goto(`${base}/`);
      return;
    }

    // Load DM conversations (placeholder)
    conversations = [];
    loading = false;
  });

  function formatPubkey(pubkey: string): string {
    return pubkey.slice(0, 12) + '...' + pubkey.slice(-8);
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  }

  function openConversation(pubkey: string) {
    goto(`${base}/dm/${pubkey}`);
  }
</script>

<svelte:head>
  <title>Direct Messages - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-2xl">
  <div class="mb-6">
    <h1 class="text-4xl font-bold gradient-text mb-2">Direct Messages</h1>
    <p class="text-base-content/70">Private encrypted conversations</p>
  </div>

  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <div class="loading loading-spinner loading-lg text-primary"></div>
    </div>
  {:else if conversations.length === 0}
    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <p class="text-base-content/70">No conversations yet. Start chatting!</p>
      </div>
    </div>
  {:else}
    <div class="space-y-2">
      {#each conversations as conv (conv.pubkey)}
        <button
          class="card bg-base-200 hover:bg-base-300 transition-base cursor-pointer w-full text-left"
          on:click={() => openConversation(conv.pubkey)}
        >
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-12">
                  <span class="text-xl">{conv.pubkey.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1">
                  <h3 class="font-semibold">{formatPubkey(conv.pubkey)}</h3>
                  <span class="text-xs text-base-content/60">
                    {formatTime(conv.lastMessage.created_at)}
                  </span>
                </div>
                <p class="text-sm text-base-content/70 truncate">
                  {conv.lastMessage.content}
                </p>
              </div>
              {#if conv.unread > 0}
                <div class="badge badge-primary badge-sm">{conv.unread}</div>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
