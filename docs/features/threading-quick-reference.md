# Threading Quick Reference

## Quick Start

### 1. Import Required Components

```typescript
import { replyStore, threadStore } from '$lib/stores/reply';
import QuotedMessage from '$lib/components/chat/QuotedMessage.svelte';
```

### 2. Add Reply/Quote Buttons

```svelte
<button on:click={() => replyStore.setReplyTo(message)}>
  Reply
</button>

<button on:click={() => replyStore.setQuoteTo(message)}>
  Quote
</button>
```

### 3. Show Reply Preview in Input

```svelte
{#if $replyStore}
  <div class="reply-preview">
    <span>{$replyStore.type === 'reply' ? 'Replying to' : 'Quoting'}</span>
    <QuotedMessage
      message={$replyStore.message}
      compact={true}
      showTimestamp={false}
    />
    <button on:click={() => replyStore.clear()}>Cancel</button>
  </div>
{/if}
```

### 4. Build Tags When Sending

```typescript
const tags: string[][] = [];

if ($replyStore?.type === 'reply') {
  tags.push(['e', $replyStore.message.id, '', 'reply']);
  tags.push(['e', rootId, '', 'root']); // Find root from parent
  tags.push(['p', $replyStore.message.authorPubkey]);
}

const message = {
  // ... other fields
  tags,
  replyTo: $replyStore?.type === 'reply' ? $replyStore.message.id : undefined
};

replyStore.clear(); // Clear after sending
```

### 5. Display Threaded Messages

```svelte
{#if message.replyTo}
  <QuotedMessage
    message={findMessageById(message.replyTo)}
    compact={true}
    on:click={(e) => scrollToMessage(e.detail.messageId)}
  />
{/if}
```

## Store API Cheat Sheet

### replyStore

| Method | Purpose |
|--------|---------|
| `setReplyTo(msg)` | Set message to reply to |
| `setQuoteTo(msg)` | Set message to quote |
| `clear()` | Clear reply/quote state |
| `$replyStore` | Get current context |

### threadStore

| Method | Purpose |
|--------|---------|
| `parseMessageTags(msg)` | Extract thread info from tags |
| `getRelationship(id)` | Get thread relationship |
| `getReplies(id)` | Get all replies to message |
| `clear()` | Clear all thread data |

## NIP-10 Tag Format

### Reply Tags
```typescript
[
  ['e', replyToId, '', 'reply'],
  ['e', rootId, '', 'root'],
  ['p', authorPubkey]
]
```

### Quote Tags
```typescript
[
  ['e', quotedId, '', 'mention'],
  ['p', authorPubkey]
]
```

## Common Patterns

### Find Root of Thread
```typescript
function findRoot(message: Message): string {
  const rootTag = message.tags?.find(
    tag => tag[0] === 'e' && tag[3] === 'root'
  );
  return rootTag?.[1] || message.id;
}
```

### Build Reply Tags
```typescript
function buildReplyTags(parentMessage: Message): string[][] {
  const tags: string[][] = [
    ['e', parentMessage.id, '', 'reply'],
    ['p', parentMessage.authorPubkey]
  ];

  const rootTag = parentMessage.tags?.find(
    tag => tag[0] === 'e' && tag[3] === 'root'
  );

  if (rootTag) {
    tags.push(['e', rootTag[1], '', 'root']);
  } else {
    tags.push(['e', parentMessage.id, '', 'root']);
  }

  return tags;
}
```

### Scroll to Message
```typescript
function scrollToMessage(messageId: string) {
  const element = document.getElementById(`message-${messageId}`);
  element?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}
```

### Parse Thread Info
```typescript
function getThreadInfo(message: Message) {
  const replyTag = message.tags?.find(
    tag => tag[0] === 'e' && tag[3] === 'reply'
  );
  const rootTag = message.tags?.find(
    tag => tag[0] === 'e' && tag[3] === 'root'
  );

  return {
    isReply: !!replyTag,
    replyTo: replyTag?.[1],
    root: rootTag?.[1]
  };
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Cancel reply/quote |
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Component Props

### QuotedMessage

```typescript
export let message: Message;
export let compact: boolean = false;
export let showTimestamp: boolean = true;

// Events
on:click // Dispatched when clicked
```

## Styling Classes

```css
.quoted-message        /* Container */
.reply-preview         /* Input preview bar */
.reply-context         /* Message thread context */
.quote-context         /* Quote display area */
.thread-indicator      /* Visual thread line */
```

## Integration Checklist

- [ ] Import replyStore and threadStore
- [ ] Import QuotedMessage component
- [ ] Add Reply/Quote buttons to MessageItem
- [ ] Show reply preview in MessageInput
- [ ] Build tags in sendMessage function
- [ ] Clear replyStore after sending
- [ ] Parse tags on message load
- [ ] Display threaded context in MessageItem
- [ ] Handle scroll-to-message events
- [ ] Add Esc key handler

## Troubleshooting

### Reply not showing
- Check `$replyStore` is set
- Verify QuotedMessage is rendered
- Ensure message object is valid

### Tags not working
- Confirm tags array format
- Check marker values ('reply', 'root', 'mention')
- Validate tag structure: `['e', id, '', marker]`

### Scroll not working
- Verify message has `id="message-{id}"`
- Check scrollIntoView browser support
- Ensure message is in DOM

### Thread depth issues
- Verify root tag propagation
- Check parent message tags exist
- Validate tag parsing logic

## Examples

See `/examples/` directory:
- `threading-integration-example.svelte` - Full component example
- `messageInput-threading-integration.ts` - Helper functions

## Documentation

- `/docs/threading-implementation.md` - Complete implementation guide
- `/docs/phase-2.2-threading-summary.md` - Feature summary
