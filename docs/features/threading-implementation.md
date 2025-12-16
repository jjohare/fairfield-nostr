[← Back to Main README](../README.md)

# Quote/Reply Threading Implementation

## Overview

This document describes the quote/reply threading implementation for Minimoonoir Nostr (Phase 2.2).

## Components Created

### 1. Reply Store (`src/lib/stores/reply.ts`)

Manages reply and quote state:

```typescript
// Set message to reply to
replyStore.setReplyTo(message);

// Set message to quote
replyStore.setQuoteTo(message);

// Clear reply/quote state
replyStore.clear();

// Access current reply context
$replyStore // { message: Message, type: 'reply' | 'quote' } | null
```

### 2. Thread Store (`src/lib/stores/reply.ts`)

Parses and manages thread relationships:

```typescript
// Parse message tags to extract thread info
threadStore.parseMessageTags(message);

// Get thread relationship
threadStore.getRelationship(messageId);

// Get all replies to a message
threadStore.getReplies(messageId);
```

### 3. QuotedMessage Component (`src/lib/components/chat/QuotedMessage.svelte`)

Displays quoted/replied messages:

```svelte
<QuotedMessage
  message={quotedMessage}
  compact={true}
  showTimestamp={false}
  on:click={handleClick}
/>
```

Features:
- Compact and full display modes
- Left border accent in primary color
- Author name and content snippet
- Truncated content with "..." in compact mode
- Click to expand or scroll to original
- Encrypted message indicator

## Integration Points

### MessageItem.svelte

Add to script section:
```svelte
import { replyStore, threadStore } from '$lib/stores/reply';
import QuotedMessage from './QuotedMessage.svelte';

export let quotedMessage: Message | null = null;
export let repliedMessage: Message | null = null;

let showFullQuote = false;

onMount(() => {
  if (message.tags) {
    threadStore.parseMessageTags(message);
  }
});

function handleReply() {
  replyStore.setReplyTo(message);
}

function handleQuote() {
  replyStore.setQuoteTo(message);
}

function handleScrollToQuoted(event) {
  dispatch('scrollTo', { messageId: event.detail.messageId });
}
```

Add to template (before message content):
```svelte
{#if repliedMessage}
  <div class="mb-2">
    <QuotedMessage
      message={repliedMessage}
      compact={true}
      on:click={handleScrollToQuoted}
    />
  </div>
{/if}

{#if quotedMessage && !repliedMessage}
  <div class="mb-2">
    <QuotedMessage
      message={quotedMessage}
      compact={!showFullQuote}
      on:click={() => showFullQuote = !showFullQuote}
    />
  </div>
{/if}
```

Add buttons to actions section:
```svelte
<button
  class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100"
  on:click={handleReply}
>
  Reply
</button>

<button
  class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100"
  on:click={handleQuote}
>
  Quote
</button>
```

### MessageInput.svelte

Add to script section:
```svelte
import { replyStore } from '$lib/stores/reply';
import QuotedMessage from './QuotedMessage.svelte';

$: placeholder = canSend
  ? $replyStore
    ? `Reply to ${getAuthorName($replyStore.message.authorPubkey)}...`
    : 'Type a message...'
  : '...';

function handleCancelReply() {
  replyStore.clear();
}

async function handleKeyDown(event: KeyboardEvent) {
  // ... existing code ...
  if (event.key === 'Escape' && $replyStore) {
    handleCancelReply();
  }
}
```

Update sendMessage to include tags:
```svelte
async function sendMessage() {
  const replyContext = $replyStore;
  const tags: string[][] = [];

  if (replyContext) {
    if (replyContext.type === 'reply') {
      tags.push(['e', replyContext.message.id, '', 'reply']);

      // Include root if replying to a reply
      if (replyContext.message.tags) {
        const rootTag = replyContext.message.tags.find(
          (tag) => tag[0] === 'e' && tag[3] === 'root'
        );
        if (rootTag) {
          tags.push(['e', rootTag[1], '', 'root']);
        } else {
          tags.push(['e', replyContext.message.id, '', 'root']);
        }
      } else {
        tags.push(['e', replyContext.message.id, '', 'root']);
      }
    } else if (replyContext.type === 'quote') {
      tags.push(['e', replyContext.message.id, '', 'mention']);
    }

    tags.push(['p', replyContext.message.authorPubkey]);
  }

  const message: Message = {
    // ... existing fields ...
    tags: tags.length > 0 ? tags : undefined,
    replyTo: replyContext?.type === 'reply' ? replyContext.message.id : undefined,
    quotedMessages: replyContext?.type === 'quote' ? [replyContext.message.id] : undefined
  };

  // Send message...
  replyStore.clear();
}
```

Add reply preview bar:
```svelte
{#if $replyStore}
  <div class="mb-3 relative">
    <div class="flex items-start gap-2 bg-base-200 rounded-lg p-2">
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-semibold text-primary">
            {$replyStore.type === 'reply' ? 'Replying to' : 'Quoting'}
          </span>
        </div>
        <QuotedMessage
          message={$replyStore.message}
          compact={true}
          showTimestamp={false}
        />
      </div>
      <button
        class="btn btn-ghost btn-xs btn-square"
        on:click={handleCancelReply}
      >
        X
      </button>
    </div>
  </div>
{/if}
```

## Message Type Updates

Update `src/lib/types/channel.ts`:

```typescript
export interface Message {
  id: string;
  channelId: string;
  authorPubkey: string;
  content: string;
  createdAt: number;
  isEncrypted: boolean;
  decryptedContent?: string;
  tags?: string[][];          // NEW: Nostr event tags
  replyTo?: string;           // NEW: Direct reply target
  quotedMessages?: string[];  // NEW: Quoted message IDs
}
```

## Nostr NIP-10 Threading

Tags follow NIP-10 (thread replies):

```typescript
// Reply to a message
['e', <message-id>, '', 'reply']  // Direct reply
['e', <root-id>, '', 'root']      // Thread root
['p', <author-pubkey>]             // Mentioned author

// Quote a message
['e', <message-id>, '', 'mention'] // Quoted/mentioned
['p', <author-pubkey>]             // Quoted author
```

## Features

1. **Reply Threading**
   - Click "Reply" to reply to any message
   - Preview shows who you're replying to
   - Maintains thread hierarchy with root tracking
   - Press Esc to cancel reply

2. **Quote Messages**
   - Click "Quote" to quote a message
   - Quoted message shows above new message
   - Click quoted message to expand/collapse
   - Supports multiple quoted messages

3. **Thread Navigation**
   - Click on quoted/replied message to scroll to original
   - Visual thread indicators
   - Compact preview mode for space efficiency

4. **UI/UX**
   - Reply and Quote buttons appear on hover
   - Visual feedback for active reply/quote
   - Clear cancel option
   - Keyboard shortcuts (Esc to cancel)

## Usage Example

```typescript
// User clicks "Reply" on a message
handleReply(message);
// replyStore now contains { message, type: 'reply' }

// User types their reply
messageText = "Great point!";

// User sends (Enter key)
// Tags are automatically added:
// [
//   ['e', 'original-msg-id', '', 'reply'],
//   ['e', 'thread-root-id', '', 'root'],
//   ['p', 'original-author-pubkey']
// ]

// Message is sent with thread context
// replyStore is cleared
```

## Future Enhancements

1. Thread view toggle (flat vs threaded)
2. Thread collapse/expand
3. Thread depth indicators
4. Jump to parent/child messages
5. Thread summary/preview
6. Notification for replies to your messages
