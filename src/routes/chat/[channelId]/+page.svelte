<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { setSigner, connectNDK } from '$lib/nostr/ndk';
  import {
    fetchChannels,
    fetchChannelMessages,
    sendChannelMessage,
    subscribeToChannel,
    type CreatedChannel
  } from '$lib/nostr/channels';
  import { getAvatarUrl as getLocalAvatarUrl } from '$lib/utils/identicon';

  $: channelId = $page.params.channelId;

  let channel: CreatedChannel | null = null;
  let messages: Array<{
    id: string;
    content: string;
    pubkey: string;
    createdAt: number;
    replyTo?: string;
  }> = [];
  let messageInput = '';
  let loading = true;
  let sending = false;
  let error: string | null = null;
  let messagesContainer: HTMLDivElement;
  let unsubscribe: (() => void) | null = null;

  // New feature state
  let showScrollButton = false;
  let isTyping = false;
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let messageCount = 0;
  let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

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

      // Connect and fetch channels
      await connectNDK();
      const channels = await fetchChannels();
      channel = channels.find(c => c.id === channelId) || null;

      if (!channel) {
        error = 'Channel not found';
        loading = false;
        return;
      }

      // Fetch existing messages
      messages = await fetchChannelMessages(channelId);
      messageCount = messages.length;

      // Subscribe to new messages
      const sub = subscribeToChannel(channelId, (newMessage) => {
        // Avoid duplicates
        if (!messages.find(m => m.id === newMessage.id)) {
          messages = [...messages, newMessage];
          messageCount = messages.length;
          scrollToBottom();
        }
      });
      unsubscribe = sub.unsubscribe;

      // Set up time update interval for relative timestamps
      timeUpdateInterval = setInterval(() => {
        messages = [...messages]; // Trigger reactivity for timestamp updates
      }, 60000); // Update every minute

    } catch (e) {
      console.error('Error loading channel:', e);
      error = e instanceof Error ? e.message : 'Failed to load channel';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }
  });

  async function sendMessage() {
    if (!messageInput.trim() || sending || !channel) return;

    sending = true;
    const content = messageInput;
    messageInput = '';

    try {
      const msgId = await sendChannelMessage(channelId, content);
      console.log('Message sent:', msgId);
      scrollToBottom();
    } catch (e) {
      console.error('Error sending message:', e);
      messageInput = content; // Restore on error
      error = e instanceof Error ? e.message : 'Failed to send message';
    } finally {
      sending = false;
    }
  }

  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }
  }

  function handleScroll() {
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      showScrollButton = scrollHeight - scrollTop - clientHeight > 100;
    }
  }

  function handleInput() {
    isTyping = true;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
      isTyping = false;
    }, 2000);
  }

  function formatRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `${mins}m ago`;
    }
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours}h ago`;
    }
    if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return `${days}d ago`;
    }

    return new Date(timestamp * 1000).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function shortenPubkey(pubkey: string): string {
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function getAvatarUrlForPubkey(pubkey: string): string {
    // Use local identicon generation to protect user privacy
    return getLocalAvatarUrl(pubkey, 80);
  }
</script>

<svelte:head>
  <title>{channel?.name || 'Channel'} - Minimoomaa Noir</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-[calc(100vh-64px)]">
    <div class="loading loading-spinner loading-lg text-primary"></div>
  </div>
{:else if error && !channel}
  <div class="container mx-auto p-4 max-w-4xl">
    <button class="btn btn-ghost btn-sm mb-4" on:click={() => goto(`${base}/chat`)}>
      ← Back to Channels
    </button>
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
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
        <div class="flex items-center gap-2 mt-1">
          <span class="badge badge-sm badge-ghost">{channel.visibility}</span>
          {#if channel.encrypted}
            <span class="badge badge-sm badge-primary">Encrypted</span>
          {/if}
          <span class="badge badge-sm badge-outline">{messageCount} messages</span>
        </div>
      </div>
    </div>

    {#if error}
      <div class="container mx-auto max-w-4xl p-2">
        <div class="alert alert-warning alert-sm">
          <span>{error}</span>
          <button class="btn btn-ghost btn-xs" on:click={() => error = null}>✕</button>
        </div>
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto p-4 bg-base-100 relative" bind:this={messagesContainer} on:scroll={handleScroll}>
      <div class="container mx-auto max-w-4xl">
        {#if messages.length === 0}
          <div class="flex items-center justify-center h-full text-base-content/50">
            <p>No messages yet. Start the conversation!</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each messages as message (message.id)}
              <div class="chat {message.pubkey === $authStore.publicKey ? 'chat-end' : 'chat-start'}">
                <div class="chat-image avatar">
                  <div class="w-10 rounded-full">
                    <img src={getAvatarUrlForPubkey(message.pubkey)} alt="avatar" />
                  </div>
                </div>
                <div class="chat-header opacity-70 text-xs mb-1">
                  {shortenPubkey(message.pubkey)}
                  <time class="text-xs opacity-50 ml-1">{formatRelativeTime(message.createdAt)}</time>
                </div>
                <div class="chat-bubble {message.pubkey === $authStore.publicKey ? 'chat-bubble-primary' : ''}">{message.content}</div>
                <div class="chat-footer opacity-50 text-xs">
                  {formatTime(message.createdAt)}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if showScrollButton}
        <button
          class="absolute bottom-4 right-4 btn btn-circle btn-primary shadow-lg"
          on:click={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      {/if}
    </div>

    <div class="bg-base-200 border-t border-base-300 p-4">
      <div class="container mx-auto max-w-4xl">
        <form on:submit|preventDefault={sendMessage} class="flex gap-2">
          <input
            type="text"
            class="input input-bordered flex-1"
            placeholder="Type a message..."
            bind:value={messageInput}
            on:input={handleInput}
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
