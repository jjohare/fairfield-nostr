<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { setSigner, connectNDK } from '$lib/nostr/ndk';
  import { fetchChannels, type CreatedChannel } from '$lib/nostr/channels';

  let channels: CreatedChannel[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    try {
      // Set up signer if we have a private key
      if ($authStore.privateKey) {
        setSigner($authStore.privateKey);
      }

      // Connect and fetch NIP-28 channels (kind 40)
      await connectNDK();
      channels = await fetchChannels();
    } catch (e) {
      console.error('Failed to load channels:', e);
      error = e instanceof Error ? e.message : 'Failed to load channels';
    } finally {
      loading = false;
    }
  });

  function navigateToChannel(channelId: string) {
    goto(`${base}/chat/${channelId}`);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Channels - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-4xl">
  <div class="mb-6">
    <h1 class="text-4xl font-bold gradient-text mb-2">Channels</h1>
    <p class="text-base-content/70">Join conversations in public channels</p>
  </div>

  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <div class="loading loading-spinner loading-lg text-primary"></div>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else if channels.length === 0}
    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <p class="text-base-content/70">No channels found. Create one to get started!</p>
      </div>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2">
      {#each channels as channel (channel.id)}
        <button
          class="card bg-base-200 hover:bg-base-300 transition-base cursor-pointer text-left"
          on:click={() => navigateToChannel(channel.id)}
        >
          <div class="card-body">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-content font-bold text-xl">
                {channel.name.charAt(0).toUpperCase()}
              </div>

              <div class="flex-1 min-w-0">
                <h3 class="card-title text-lg mb-1">{channel.name}</h3>
                {#if channel.description}
                  <p class="text-sm text-base-content/70 line-clamp-2">
                    {channel.description}
                  </p>
                {/if}
                <div class="flex items-center gap-3 mt-2 text-xs text-base-content/60">
                  <span class="badge badge-sm badge-ghost">{channel.visibility}</span>
                  <span>•</span>
                  <span>{formatDate(channel.createdAt)}</span>
                  {#if channel.encrypted}
                    <span class="badge badge-sm badge-primary">Encrypted</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
