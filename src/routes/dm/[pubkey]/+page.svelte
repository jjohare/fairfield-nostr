<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';

  $: recipientPubkey = $page.params.pubkey;

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

    // Load messages (placeholder)
    messages = [];
    loading = false;
  });

  async function sendMessage() {
    if (!messageInput.trim() || sending) return;

    sending = true;
    const content = messageInput;
    messageInput = '';

    try {
      // Implement actual DM sending
      console.log('Sending DM:', content);
    } catch (error) {
      console.error('Error sending DM:', error);
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

  function formatPubkey(pubkey: string): string {
    return pubkey.slice(0, 12) + '...' + pubkey.slice(-8);
  }
</script>

<svelte:head>
  <title>DM with {formatPubkey(recipientPubkey)} - Minimoomaa Noir</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-[calc(100vh-64px)]">
    <div class="loading loading-spinner loading-lg text-primary"></div>
  </div>
{:else}
  <div class="flex flex-col h-[calc(100vh-64px)]">
    <div class="bg-base-200 border-b border-base-300 p-4">
      <div class="container mx-auto max-w-2xl">
        <button class="btn btn-ghost btn-sm mb-2" on:click={() => goto(`${base}/dm`)}>
          ← Back to Messages
        </button>
        <div class="flex items-center gap-3">
          <div class="avatar placeholder">
            <div class="bg-primary text-primary-content rounded-full w-10">
              <span>{recipientPubkey.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <h1 class="text-xl font-bold">{formatPubkey(recipientPubkey)}</h1>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 bg-base-100" bind:this={messagesContainer}>
      <div class="container mx-auto max-w-2xl">
        {#if messages.length === 0}
          <div class="flex items-center justify-center h-full text-base-content/50">
            <p>No messages yet. Start the conversation!</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each messages as message (message.id)}
              <div class="chat {message.pubkey === $authStore.publicKey ? 'chat-end' : 'chat-start'}">
                <div class="chat-bubble">
                  {message.content}
                </div>
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
      <div class="container mx-auto max-w-2xl">
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
