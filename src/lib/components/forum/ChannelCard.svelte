<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { ndk, connectNDK } from '$lib/nostr/ndk';
  import { browser } from '$app/environment';
  import { lastReadStore } from '$lib/stores/readPosition';
  import { formatUnreadCount } from '$lib/utils/readPosition';
  import type { CreatedChannel } from '$lib/nostr/channels';
  import type { Message } from '$lib/types/channel';

  export let channel: CreatedChannel;

  let messageCount = 0;
  let lastPost: {
    content: string;
    author: string;
    timestamp: number;
  } | null = null;
  let loading = true;
  let messages: Message[] = [];
  let unreadCount = 0;

  // Forum category icons based on channel name keywords
  const categoryIcons: Record<string, string> = {
    general: '💬',
    music: '🎵',
    tuneage: '🎵',
    events: '📅',
    calendar: '📅',
    help: '❓',
    support: '🆘',
    announcements: '📢',
    news: '📰',
    random: '🎲',
    offtopic: '💭',
    tech: '💻',
    gaming: '🎮',
    art: '🎨',
    photos: '📷',
    video: '🎬',
    food: '🍕',
    sports: '⚽',
    fitness: '💪',
    books: '📚',
    movies: '🎬',
    pets: '🐕',
    travel: '✈️',
    memes: '😂',
    default: '💭',
  };

  function getIcon(name: string): string {
    const lower = name.toLowerCase();
    for (const [keyword, icon] of Object.entries(categoryIcons)) {
      if (lower.includes(keyword)) return icon;
    }
    return categoryIcons.default;
  }

  onMount(async () => {
    if (!browser) return;

    try {
      await connectNDK();

      // Fetch messages for this channel
      const events = await ndk.fetchEvents({
        kinds: [42],
        '#e': [channel.id],
        limit: 100,
      });

      messageCount = events.size;

      // Convert events to messages and find the most recent
      messages = Array.from(events).map(event => ({
        id: event.id,
        channelId: channel.id,
        authorPubkey: event.pubkey,
        content: event.content,
        createdAt: event.created_at || 0,
        isEncrypted: false
      }));

      // Calculate unread count
      unreadCount = lastReadStore.getUnreadCount(channel.id, messages);

      // Find the most recent message
      let latest: { content: string; pubkey: string; created_at: number } | null = null;
      for (const event of events) {
        if (!latest || (event.created_at || 0) > latest.created_at) {
          latest = {
            content: event.content,
            pubkey: event.pubkey,
            created_at: event.created_at || 0,
          };
        }
      }

      if (latest) {
        lastPost = {
          content: latest.content.substring(0, 60) + (latest.content.length > 60 ? '...' : ''),
          author: latest.pubkey.substring(0, 8) + '...',
          timestamp: latest.created_at,
        };
      }
    } catch (e) {
      console.error('Failed to fetch channel stats:', e);
    } finally {
      loading = false;
    }
  });

  function formatRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function navigate() {
    goto(`${base}/chat/${channel.id}`);
  }
</script>

<button
  class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer text-left w-full border border-transparent hover:border-primary/30"
  on:click={navigate}
>
  <div class="card-body p-4">
    <div class="flex gap-4">
      <!-- Category Icon -->
      <div class="flex-shrink-0">
        <div class="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-2xl">
          {getIcon(channel.name)}
        </div>
      </div>

      <!-- Channel Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-base truncate">{channel.name}</h3>
              {#if !loading && unreadCount > 0}
                <span class="badge badge-primary badge-sm rounded-full">
                  {formatUnreadCount(unreadCount)}
                </span>
              {/if}
            </div>
            {#if channel.description}
              <p class="text-sm text-base-content/70 line-clamp-1 mt-0.5">
                {channel.description}
              </p>
            {/if}
          </div>

          <!-- Stats badges -->
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            {#if loading}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              <div class="badge badge-primary badge-sm">
                {messageCount} posts
              </div>
              {#if channel.encrypted}
                <div class="badge badge-secondary badge-sm">
                  🔒 Encrypted
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Last Post Info -->
        {#if lastPost}
          <div class="mt-2 pt-2 border-t border-base-300 text-xs text-base-content/60">
            <div class="flex items-center gap-2">
              <img
                src="https://api.dicebear.com/7.x/identicon/svg?seed={lastPost.author}"
                alt=""
                class="w-4 h-4 rounded-full"
              />
              <span class="truncate flex-1">{lastPost.content}</span>
              <span class="flex-shrink-0">{formatRelativeTime(lastPost.timestamp)}</span>
            </div>
          </div>
        {:else if !loading}
          <div class="mt-2 pt-2 border-t border-base-300 text-xs text-base-content/40 italic">
            No messages yet - be the first to post!
          </div>
        {/if}
      </div>
    </div>
  </div>
</button>
