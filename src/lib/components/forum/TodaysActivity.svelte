<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { ndk, connectNDK } from '$lib/nostr/ndk';
  import { browser } from '$app/environment';

  interface ActiveTopic {
    channelId: string;
    channelName: string;
    lastMessage: string;
    lastAuthor: string;
    lastTimestamp: number;
    messageCount: number;
  }

  let activeTopics: ActiveTopic[] = [];
  let loading = true;

  onMount(async () => {
    if (!browser) return;

    try {
      await connectNDK();

      const todayStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

      // Fetch today's messages
      const messageEvents = await ndk.fetchEvents({
        kinds: [42],
        since: todayStart,
        limit: 500,
      });

      // Fetch channel metadata
      const channelEvents = await ndk.fetchEvents({
        kinds: [40],
        limit: 100,
      });

      // Build channel name map
      const channelNames: Map<string, string> = new Map();
      for (const event of channelEvents) {
        try {
          const meta = JSON.parse(event.content);
          channelNames.set(event.id, meta.name || 'Unnamed');
        } catch {
          channelNames.set(event.id, 'Unnamed');
        }
      }

      // Group messages by channel
      const channelActivity: Map<string, {
        messages: Array<{ content: string; pubkey: string; timestamp: number }>;
      }> = new Map();

      for (const event of messageEvents) {
        const channelTag = event.tags.find(t => t[0] === 'e' && t[3] === 'root');
        if (!channelTag) continue;

        const channelId = channelTag[1];
        if (!channelActivity.has(channelId)) {
          channelActivity.set(channelId, { messages: [] });
        }

        channelActivity.get(channelId)!.messages.push({
          content: event.content,
          pubkey: event.pubkey,
          timestamp: event.created_at || 0,
        });
      }

      // Build active topics list
      activeTopics = Array.from(channelActivity.entries())
        .map(([channelId, data]) => {
          const sorted = data.messages.sort((a, b) => b.timestamp - a.timestamp);
          const latest = sorted[0];
          return {
            channelId,
            channelName: channelNames.get(channelId) || channelId.substring(0, 8) + '...',
            lastMessage: latest.content.substring(0, 50) + (latest.content.length > 50 ? '...' : ''),
            lastAuthor: latest.pubkey.substring(0, 8) + '...',
            lastTimestamp: latest.timestamp,
            messageCount: data.messages.length,
          };
        })
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 5);

    } catch (e) {
      console.error('Failed to fetch today\'s activity:', e);
    } finally {
      loading = false;
    }
  });

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function goToChannel(channelId: string) {
    goto(`${base}/chat/${channelId}`);
  }
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <h3 class="card-title text-lg text-primary mb-2">Today's Active Topics</h3>

    {#if loading}
      <div class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
    {:else if activeTopics.length === 0}
      <p class="text-base-content/60 text-sm text-center py-2">
        No activity today yet
      </p>
    {:else}
      <div class="space-y-3">
        {#each activeTopics as topic}
          <button
            class="w-full text-left hover:bg-base-300 rounded-lg p-2 -mx-2 transition-colors"
            on:click={() => goToChannel(topic.channelId)}
          >
            <div class="flex items-start gap-2">
              <div class="badge badge-primary badge-sm mt-1">{topic.messageCount}</div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">{topic.channelName}</div>
                <div class="text-xs text-base-content/60 truncate">
                  {topic.lastMessage}
                </div>
                <div class="text-xs text-base-content/40 mt-1">
                  by {topic.lastAuthor} at {formatTime(topic.lastTimestamp)}
                </div>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
