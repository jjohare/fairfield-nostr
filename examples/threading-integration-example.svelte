<script lang="ts">
  /**
   * Example: How to integrate reply/quote threading with MessageItem
   *
   * This example shows how to add threading support to your existing
   * MessageItem component without breaking current functionality.
   */

  import { onMount } from 'svelte';
  import { replyStore, threadStore } from '$lib/stores/reply';
  import type { Message } from '$lib/types/channel';
  import QuotedMessage from '$lib/components/chat/QuotedMessage.svelte';

  // Example messages array
  let messages: Message[] = [];

  // Load messages and build thread relationships
  onMount(() => {
    messages.forEach(message => {
      if (message.tags) {
        threadStore.parseMessageTags(message);
      }
    });
  });

  // Helper to find quoted/replied messages
  function findMessageById(id: string): Message | null {
    return messages.find(m => m.id === id) || null;
  }

  // Get thread context for a message
  function getThreadContext(message: Message) {
    const relationship = threadStore.getRelationship(message.id);

    return {
      repliedMessage: relationship?.replyTo
        ? findMessageById(relationship.replyTo)
        : null,
      quotedMessages: relationship?.quotedMessages
        ? relationship.quotedMessages.map(findMessageById).filter(Boolean)
        : []
    };
  }
</script>

<!-- Example message list with threading -->
<div class="message-list">
  {#each messages as message (message.id)}
    {@const { repliedMessage, quotedMessages } = getThreadContext(message)}

    <div class="message-wrapper" id="message-{message.id}">
      <!-- Show reply context if this is a reply -->
      {#if repliedMessage}
        <div class="reply-context mb-2 pl-4">
          <QuotedMessage
            message={repliedMessage}
            compact={true}
            on:click={(e) => {
              // Scroll to the replied message
              const element = document.getElementById(`message-${e.detail.messageId}`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </div>
      {/if}

      <!-- Show quoted messages if this is a quote -->
      {#if quotedMessages.length > 0 && !repliedMessage}
        <div class="quote-context mb-2 pl-4">
          {#each quotedMessages as quoted}
            <QuotedMessage
              message={quoted}
              compact={false}
              on:click={(e) => {
                const element = document.getElementById(`message-${e.detail.messageId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          {/each}
        </div>
      {/if}

      <!-- Your existing MessageItem component -->
      <!-- Add reply/quote buttons to the actions -->
      <div class="message-item">
        <div class="message-content">
          {message.content}
        </div>

        <div class="message-actions">
          <button
            on:click={() => replyStore.setReplyTo(message)}
            class="btn-reply"
          >
            Reply
          </button>

          <button
            on:click={() => replyStore.setQuoteTo(message)}
            class="btn-quote"
          >
            Quote
          </button>
        </div>
      </div>
    </div>
  {/each}
</div>

<!-- Message input with reply preview -->
<div class="message-input-wrapper">
  {#if $replyStore}
    <div class="reply-preview">
      <div class="reply-header">
        {$replyStore.type === 'reply' ? 'Replying to' : 'Quoting'}
      </div>
      <QuotedMessage
        message={$replyStore.message}
        compact={true}
        showTimestamp={false}
      />
      <button
        on:click={() => replyStore.clear()}
        class="btn-cancel"
      >
        Cancel
      </button>
    </div>
  {/if}

  <!-- Your existing MessageInput component -->
</div>

<style>
  .message-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .message-wrapper {
    scroll-margin-top: 2rem; /* For smooth scroll-into-view */
  }

  .reply-context,
  .quote-context {
    margin-left: 2rem;
    opacity: 0.9;
  }

  .message-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .message-item:hover .message-actions {
    opacity: 1;
  }

  .reply-preview {
    background: var(--bg-base-200);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    position: relative;
  }

  .reply-header {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--primary);
    margin-bottom: 0.5rem;
  }

  .btn-cancel {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }
</style>
