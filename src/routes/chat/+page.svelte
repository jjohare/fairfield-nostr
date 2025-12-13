<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { setSigner, connectNDK } from '$lib/nostr/ndk';
  import { fetchChannels, type CreatedChannel } from '$lib/nostr/channels';

  // Forum components
  import BoardStats from '$lib/components/forum/BoardStats.svelte';
  import TopPosters from '$lib/components/forum/TopPosters.svelte';
  import WelcomeBack from '$lib/components/forum/WelcomeBack.svelte';
  import TodaysActivity from '$lib/components/forum/TodaysActivity.svelte';
  import ChannelCard from '$lib/components/forum/ChannelCard.svelte';
  import MarkAllRead from '$lib/components/forum/MarkAllRead.svelte';
  import ModeratorTeam from '$lib/components/forum/ModeratorTeam.svelte';

  let channels: CreatedChannel[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    // Wait for auth store to be ready before checking authentication
    await authStore.waitForReady();

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

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Channels - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <!-- Welcome Back Banner -->
  <div class="mb-4">
    <WelcomeBack />
  </div>

  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Main Content -->
    <div class="flex-1">
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-4xl font-bold gradient-text mb-2">Channels</h1>
            <p class="text-base-content/70">Join conversations in public channels</p>
          </div>
          <div class="flex items-center gap-2">
            <MarkAllRead />
          </div>
        </div>
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
        <div class="space-y-3">
          {#each channels as channel (channel.id)}
            <ChannelCard {channel} />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sidebar -->
    <div class="lg:w-80 space-y-4">
      <BoardStats />
      <TodaysActivity />
      <TopPosters />
      <ModeratorTeam />
    </div>
  </div>
</div>
