<script lang="ts">
  import { onMount } from 'svelte';
  import { ndk, connectNDK } from '$lib/nostr/ndk';
  import { browser } from '$app/environment';
  import { getAvatarUrl } from '$lib/utils/identicon';

  interface Poster {
    pubkey: string;
    displayName: string;
    postCount: number;
    avatar?: string;
  }

  let topPostersToday: Poster[] = [];
  let topPostersAllTime: Poster[] = [];
  let activeTab: 'today' | 'alltime' = 'today';
  let loading = true;

  onMount(async () => {
    if (!browser) return;

    try {
      await connectNDK();

      // Fetch all messages
      const messageEvents = await ndk.fetchEvents({
        kinds: [42],
        limit: 2000,
      });

      const todayStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      const postCountsToday: Map<string, number> = new Map();
      const postCountsAllTime: Map<string, number> = new Map();

      for (const event of messageEvents) {
        // All time counts
        postCountsAllTime.set(
          event.pubkey,
          (postCountsAllTime.get(event.pubkey) || 0) + 1
        );

        // Today's counts
        if ((event.created_at || 0) > todayStart) {
          postCountsToday.set(
            event.pubkey,
            (postCountsToday.get(event.pubkey) || 0) + 1
          );
        }
      }

      // Convert to sorted arrays
      const formatPosters = (counts: Map<string, number>): Poster[] => {
        return Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([pubkey, postCount]) => ({
            pubkey,
            displayName: pubkey.substring(0, 8) + '...',
            postCount,
            avatar: getAvatarUrl(pubkey, 48),
          }));
      };

      topPostersToday = formatPosters(postCountsToday);
      topPostersAllTime = formatPosters(postCountsAllTime);

    } catch (e) {
      console.error('Failed to fetch top posters:', e);
    } finally {
      loading = false;
    }
  });

  $: currentPosters = activeTab === 'today' ? topPostersToday : topPostersAllTime;
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <h3 class="card-title text-lg text-primary mb-2">Top 10 Posters</h3>

    <div class="tabs tabs-boxed bg-base-300 mb-3">
      <button
        class="tab tab-sm {activeTab === 'today' ? 'tab-active' : ''}"
        on:click={() => activeTab = 'today'}
      >
        Today
      </button>
      <button
        class="tab tab-sm {activeTab === 'alltime' ? 'tab-active' : ''}"
        on:click={() => activeTab = 'alltime'}
      >
        All Time
      </button>
    </div>

    {#if loading}
      <div class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
    {:else if currentPosters.length === 0}
      <p class="text-base-content/60 text-sm text-center py-2">
        No posts {activeTab === 'today' ? 'today' : ''} yet
      </p>
    {:else}
      <div class="space-y-2">
        {#each currentPosters as poster, i}
          <div class="flex items-center gap-2 text-sm">
            <span class="w-5 text-base-content/60 font-mono">{i + 1}.</span>
            <img
              src={poster.avatar}
              alt=""
              class="w-6 h-6 rounded-full"
            />
            <span class="flex-1 truncate font-mono text-xs">
              {poster.displayName}
            </span>
            <span class="badge badge-sm badge-primary">{poster.postCount}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
