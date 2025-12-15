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

  // UI components
  import { SkeletonLoader, EmptyState } from '$lib/components/ui';

  // Semantic search
  import { SemanticSearch } from '$lib/semantic';

  let channels: CreatedChannel[] = [];
  let loading = true;
  let error: string | null = null;
  let showSearch = false;

  async function handleSearchSelect(noteId: string) {
    // Search for the message in channels and navigate to it
    showSearch = false;

    // Find which channel contains this message by checking channel messages
    for (const channel of channels) {
      // Navigate to channel - the channel page will handle scrolling to the message
      // if the noteId is passed as a query parameter
      if (channel.id) {
        goto(`${base}/chat/${channel.id}?highlight=${noteId}`);
        return;
      }
    }

    // Fallback: log if message not found in any loaded channel
    console.warn('Message not found in loaded channels:', noteId);
  }

  onMount(async () => {
    // Wait for auth store to be ready before checking authentication
    await authStore.waitForReady();

    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    // Redirect to pending page if user is awaiting approval
    if ($authStore.isPending) {
      goto(`${base}/pending`);
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
            <button
              class="btn btn-ghost btn-sm"
              on:click={() => showSearch = !showSearch}
              title="Semantic Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span class="hidden sm:inline">Search</span>
            </button>
            <MarkAllRead />
          </div>
        </div>
      </div>

      <!-- Semantic Search Panel -->
      {#if showSearch}
        <div class="card bg-base-200 shadow-lg mb-6">
          <div class="card-body p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold">Semantic Search</h3>
              <button class="btn btn-ghost btn-sm btn-circle" on:click={() => showSearch = false}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-sm text-base-content/70 mb-3">
              Search by meaning, not just keywords. Find messages that are semantically similar to your query.
            </p>
            <SemanticSearch onSelect={handleSearchSelect} placeholder="Search messages by meaning..." />
          </div>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-3">
          <SkeletonLoader variant="channel" count={5} />
        </div>
      {:else if error}
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      {:else if channels.length === 0}
        <EmptyState
          icon="💬"
          title="No channels yet"
          description="Create or join a channel to start chatting with the community"
        />
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
