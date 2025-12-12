<script lang="ts">
  import { tick } from 'svelte';
  import { channelStore, selectedChannel, userMemberStatus } from '$lib/stores/channelStore';
  import { authStore } from '$lib/stores/auth';
  import type { Message } from '$lib/types/channel';

  let messageText = '';
  let textareaElement: HTMLTextAreaElement;
  let isSending = false;

  $: canSend = $userMemberStatus === 'member' || $userMemberStatus === 'admin';
  $: placeholder = canSend
    ? 'Type a message...'
    : $userMemberStatus === 'pending'
      ? 'Your join request is pending...'
      : 'Join this channel to send messages';

  async function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !$selectedChannel || !$authStore.publicKey || !canSend || isSending) {
      return;
    }

    isSending = true;
    const content = messageText.trim();
    messageText = '';

    try {
      await tick();
      if (textareaElement) {
        textareaElement.style.height = 'auto';
      }

      const message: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        channelId: $selectedChannel.id,
        authorPubkey: $authStore.publicKey,
        content: content,
        createdAt: Date.now(),
        isEncrypted: $selectedChannel.isEncrypted,
        decryptedContent: $selectedChannel.isEncrypted ? content : undefined
      };

      channelStore.addMessage(message);

    } catch (error) {
      console.error('Failed to send message:', error);
      messageText = content;
      alert('Failed to send message. Please try again.');
    } finally {
      isSending = false;
    }
  }

  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = textareaElement.scrollHeight + 'px';
    }
  }

  function handleInput() {
    autoResize();
  }
</script>

<div class="border-t border-base-300 bg-base-100 p-4">
  <div class="flex gap-2 items-end">
    <div class="flex-1">
      <textarea
        bind:this={textareaElement}
        bind:value={messageText}
        on:keydown={handleKeyDown}
        on:input={handleInput}
        placeholder={placeholder}
        disabled={!canSend || isSending}
        rows="1"
        class="textarea textarea-bordered w-full resize-none min-h-[2.5rem] max-h-32 disabled:bg-base-200 disabled:text-base-content/50"
        style="overflow-y: auto;"
      ></textarea>
      <div class="text-xs text-base-content/60 mt-1 px-1">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>

    <button
      class="btn btn-primary btn-square"
      on:click={sendMessage}
      disabled={!messageText.trim() || !canSend || isSending}
      aria-label="Send message"
    >
      {#if isSending}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      {/if}
    </button>
  </div>

  {#if !canSend && $userMemberStatus !== 'pending'}
    <div class="alert alert-info mt-2 text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>You must be a member to send messages in this channel.</span>
    </div>
  {/if}
</div>
