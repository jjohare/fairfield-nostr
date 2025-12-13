<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { dmStore, currentConversation } from '$lib/stores/dm';
  import type { DMMessage } from '$lib/stores/dm';
  import { authStore } from '$lib/stores/auth';
  import { draftStore } from '$lib/stores/drafts';

  /**
   * Relay instance (would be passed as prop in real implementation)
   */
  export let relay: any = null;

  let messageInput = '';
  let messagesContainer: HTMLDivElement;
  let isSending = false;
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasDraft = false;

  /**
   * Load draft when conversation changes
   */
  $: if ($currentConversation) {
    loadDraft($currentConversation.pubkey);
    hasDraft = draftStore.hasDraft($currentConversation.pubkey);
  }

  /**
   * Load draft for current conversation
   */
  function loadDraft(pubkey: string) {
    const draft = draftStore.getDraft(pubkey);
    if (draft !== null) {
      messageInput = draft;
    } else {
      messageInput = '';
    }
  }

  /**
   * Save draft with debounce
   */
  function saveDraftDebounced() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      saveDraftImmediately();
    }, 1000);
  }

  /**
   * Save draft immediately
   */
  function saveDraftImmediately() {
    if ($currentConversation) {
      draftStore.saveDraft($currentConversation.pubkey, messageInput, true);
      hasDraft = draftStore.hasDraft($currentConversation.pubkey);
    }
  }

  /**
   * Handle input change
   */
  function handleInputChange() {
    saveDraftDebounced();
  }

  /**
   * Handle blur
   */
  function handleBlur() {
    saveDraftImmediately();
  }

  /**
   * Scroll to bottom of messages
   */
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Auto-scroll after messages update
   */
  afterUpdate(() => {
    scrollToBottom();
  });

  /**
   * Handle send message
   */
  async function handleSend() {
    if (!messageInput.trim() || isSending || !relay) return;

    const content = messageInput.trim();
    const recipientPubkey = $currentConversation?.pubkey;
    messageInput = '';
    isSending = true;

    try {
      // Get user's private key
      const privateKey = $authStore.privateKey;
      if (!privateKey) {
        throw new Error('No private key available');
      }

      // Convert hex private key to Uint8Array
      const userPrivkey = new Uint8Array(privateKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

      await dmStore.sendDM(content, relay, userPrivkey);

      // Clear draft after successful send
      if (recipientPubkey) {
        draftStore.clearDraft(recipientPubkey);
        hasDraft = false;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message input on error
      messageInput = content;
    } finally {
      isSending = false;
    }
  }

  /**
   * Handle Enter key press
   */
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  /**
   * Go back to conversation list
   */
  function handleBack() {
    dmStore.clearConversation();
  }

  /**
   * Format message timestamp
   */
  function formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  /**
   * Get avatar placeholder
   */
  function getAvatarPlaceholder(name: string): string {
    const initials = name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    return initials || name.substring(0, 2).toUpperCase();
  }

  onMount(() => {
    scrollToBottom();

    // Load initial draft if conversation is selected
    if ($currentConversation) {
      loadDraft($currentConversation.pubkey);
    }

    // Save draft on beforeunload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', saveDraftImmediately);
    }
  });

  onDestroy(() => {
    // Save draft before unmount
    saveDraftImmediately();

    // Clear timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Remove event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', saveDraftImmediately);
    }
  });
</script>

<div class="flex flex-col h-full bg-base-100">
  {#if $currentConversation}
    <!-- Header -->
    <div class="flex items-center gap-3 p-4 border-b border-base-300">
      <!-- Back button (mobile) -->
      <button
        class="btn btn-ghost btn-sm btn-circle lg:hidden"
        on:click={handleBack}
        aria-label="Back to conversations"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <!-- Avatar and Name -->
      <div class="avatar placeholder">
        <div class="w-10 h-10 rounded-full bg-primary text-primary-content">
          {#if $currentConversation.avatar}
            <img src={$currentConversation.avatar} alt={$currentConversation.name} />
          {:else}
            <span class="text-xs font-semibold">
              {getAvatarPlaceholder($currentConversation.name)}
            </span>
          {/if}
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <h2 class="font-semibold text-base-content truncate">
          {$currentConversation.name}
        </h2>
        <p class="text-xs text-base-content/60 truncate">
          {$currentConversation.pubkey}
        </p>
      </div>

      <!-- Menu button -->
      <div class="dropdown dropdown-end">
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Options">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
        <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52">
          <li><button>View Profile</button></li>
          <li><button>Clear Messages</button></li>
          <li><button class="text-error">Block User</button></li>
        </ul>
      </div>
    </div>

    <!-- Messages -->
    <div
      bind:this={messagesContainer}
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {#if $dmStore.messages.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-center">
          <p class="text-base-content/60 text-sm">No messages yet</p>
          <p class="text-base-content/40 text-xs mt-2">Send a message to start the conversation</p>
        </div>
      {:else}
        {#each $dmStore.messages as message (message.id)}
          <div class="chat {message.isSent ? 'chat-end' : 'chat-start'}">
            <div class="chat-image avatar placeholder">
              <div class="w-10 h-10 rounded-full bg-neutral text-neutral-content">
                <span class="text-xs">
                  {message.isSent ? 'ME' : getAvatarPlaceholder($currentConversation.name)}
                </span>
              </div>
            </div>
            <div class="chat-header mb-1">
              <time class="text-xs opacity-50">{formatMessageTime(message.timestamp)}</time>
            </div>
            <div class="chat-bubble {message.isSent ? 'chat-bubble-primary' : ''}">
              {message.content}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Input -->
    <div class="p-4 border-t border-base-300">
      <div class="flex gap-2">
        <div class="flex-1">
          <textarea
            bind:value={messageInput}
            on:keypress={handleKeyPress}
            on:input={handleInputChange}
            on:blur={handleBlur}
            placeholder="Type a message..."
            class="textarea textarea-bordered w-full resize-none"
            rows="1"
            disabled={isSending}
          />
          {#if hasDraft && messageInput.trim()}
            <div class="text-xs text-base-content/60 mt-1 px-1">
              <span class="badge badge-xs badge-warning gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Draft saved
              </span>
            </div>
          {/if}
        </div>
        <button
          class="btn btn-primary"
          on:click={handleSend}
          disabled={!messageInput.trim() || isSending}
          aria-label="Send message"
        >
          {#if isSending}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
              />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  {:else}
    <!-- No conversation selected -->
    <div class="flex flex-col items-center justify-center h-full p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-24 h-24 mb-4 text-base-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <h3 class="text-lg font-semibold mb-2">Select a conversation</h3>
      <p class="text-base-content/60 text-sm">Choose a conversation from the list to start messaging</p>
    </div>
  {/if}
</div>

<style>
  /* Auto-expand textarea */
  textarea {
    max-height: 120px;
    min-height: 2.5rem;
  }

  /* Smooth scrolling */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
</style>
