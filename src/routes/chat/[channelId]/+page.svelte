<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { channelStore } from '$lib/stores/channels';
  import { authStore } from '$lib/stores/auth';
  import { ndk } from '$lib/nostr/ndk';
  import type { Channel } from '$lib/stores/channels';

  $: channelId = $page.params.channelId;

  let channel: Channel | null = null;
  let messages: any[] = [];
  let messageInput = '';
  let loading = true;
  let sending = false;
  let messagesContainer: HTMLDivElement;

  onMount(async () => {
    if (!$authStore.isAuthenticated) {
      goto(`${base}/`);
      return;
    }

    try {
      const ndkInstance = await ndk.getNDK();
      const channels = await channelStore.fetchChannels(
        ndkInstance,
        $authStore.publicKey!,
        ['business', 'moomaa-tribe']
      );
      channel = channels.find(c => c.id === channelId) || null;

      if (!channel) {
        goto(`${base}/chat`);
        return;
      }

      // Load messages (placeholder - implement with actual Nostr events)
      messages = [];
    } catch (error) {
      console.error('Error loading channel:', error);
    } finally {
      loading = false;
    }
  });

  async function sendMessage() {
    if (!messageInput.trim() || sending || !channel) return;

    sending = true;
    const content = messageInput;
    messageInput = '';

    try {
      // Implement actual message sending via NDK
      console.log('Sending message:', content);
    } catch (error) {
      console.error('Error sending message:', error);
      messageInput = content;
    } finally {
      sending = false;
    }
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>{channel?.name || 'Channel'} - Minimoomaa Noir</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-[calc(100vh-64px)]">
    <div class="loading loading-spinner loading-lg text-primary"></div>
  </div>
{:else if channel}
  <div class="flex flex-col h-[calc(100vh-64px)]">
    <div class="bg-base-200 border-b border-base-300 p-4">
      <div class="container mx-auto max-w-4xl">
        <button class="btn btn-ghost btn-sm mb-2" on:click={() => goto(`${base}/chat`)}>
          ← Back to Channels
        </button>
        <h1 class="text-2xl font-bold">{channel.name}</h1>
        {#if channel.description}
          <p class="text-base-content/70 text-sm">{channel.description}</p>
        {/if}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 bg-base-100" bind:this={messagesContainer}>
      <div class="container mx-auto max-w-4xl">
        {#if messages.length === 0}
          <div class="flex items-center justify-center h-full text-base-content/50">
            <p>No messages yet. Start the conversation!</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each messages as message (message.id)}
              <div class="chat chat-start">
                <div class="chat-bubble">{message.content}</div>
                <div class="chat-footer opacity-50 text-xs">
                  {formatTime(message.created_at)}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-base-200 border-t border-base-300 p-4">
      <div class="container mx-auto max-w-4xl">
        <form on:submit|preventDefault={sendMessage} class="flex gap-2">
          <input
            type="text"
            class="input input-bordered flex-1"
            placeholder="Type a message..."
            bind:value={messageInput}
            disabled={sending}
          />
          <button
            type="submit"
            class="btn btn-primary"
            disabled={sending || !messageInput.trim()}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}
