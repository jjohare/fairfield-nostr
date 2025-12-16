[← Back to Main README](../README.md)

# NIP-25 Message Reactions Implementation

## Overview

Complete implementation of NIP-25 (Reactions) for Minimoonoir Nostr, enabling users to react to messages with emojis and standard +/- reactions.

## Implementation Status: COMPLETE

### Phase 1.6 - NIP-25 Reactions

**Completion Date**: 2025-12-13

## Files Created

### Core Module
- `/src/lib/nostr/reactions.ts` (400+ lines)
  - NIP-25 reaction event creation and parsing
  - Common reaction types (like, love, laugh, fire, etc.)
  - Reaction normalization and validation
  - Reaction grouping and counting utilities
  - User reaction tracking

### Store
- `/src/lib/stores/reactions.ts` (400+ lines)
  - Reaction state management
  - Real-time reaction subscription
  - Optimistic updates
  - Relay communication for reactions
  - Derived stores for message reactions

### Components
- `/src/lib/components/chat/ReactionBar.svelte`
  - Displays reaction counts below messages
  - Click to toggle user's reaction
  - Tooltip showing who reacted
  - Highlight when user has reacted

- `/src/lib/components/chat/ReactionPicker.svelte`
  - Popup with 8 common emoji reactions
  - Grid layout for easy selection
  - Mobile-responsive positioning
  - Click-outside to close

### Updated Files
- `/src/lib/components/chat/MessageItem.svelte`
  - Integrated ReactionBar component
  - Added reaction button (shows on hover)
  - Added ReactionPicker popup
  - Passed relayUrl prop for reactions

### Tests
- `/tests/reactions.test.ts` (300+ lines)
  - Comprehensive test coverage
  - Event creation and parsing tests
  - Normalization and validation tests
  - Reaction grouping and counting tests
  - User reaction tracking tests

## Features Implemented

### 1. NIP-25 Compliance
- ✅ Reaction events (kind 7)
- ✅ Event ID reference ('e' tag)
- ✅ Author pubkey reference ('p' tag, optional)
- ✅ Content normalization ('+' for like, '-' for dislike)
- ✅ Emoji support
- ✅ Proper event signing

### 2. Common Reactions
```typescript
const CommonReactions = {
  LIKE: '+',
  DISLIKE: '-',
  LOVE: '❤️',
  LAUGH: '😂',
  SURPRISED: '😮',
  SAD: '😢',
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  FIRE: '🔥',
  PARTY: '🎉',
};
```

### 3. Store Features
- Optimistic updates (instant UI feedback)
- Real-time subscription to reaction events
- Batch fetching for multiple messages
- De-duplication of reactions
- User reaction tracking
- Reaction summary by message

### 4. UI Components
**ReactionBar:**
- Shows reaction counts with emojis
- Highlights user's reaction
- Click to toggle reaction
- Tooltip with reactor names

**ReactionPicker:**
- 4x2 grid of common reactions
- Mobile-responsive
- Accessible (ARIA labels, keyboard support)
- Click-outside to close

**MessageItem Integration:**
- Reaction button (smiley icon on hover)
- ReactionBar below message content
- ReactionPicker popup

## API Reference

### Reactions Module (`/src/lib/nostr/reactions.ts`)

#### Create Reaction Event
```typescript
createReactionEvent(
  messageId: string,
  content: string,
  privkey: string,
  authorPubkey?: string
): NostrEvent
```

#### Parse Reaction Event
```typescript
parseReactionEvent(event: NostrEvent): ReactionData | null
```

#### Utility Functions
- `normalizeReactionContent(content: string): string`
- `isLikeReaction(content: string): boolean`
- `isDislikeReaction(content: string): boolean`
- `getReactionEmoji(content: string): string`
- `groupReactionsByContent(reactions: ReactionData[]): Map<string, string[]>`
- `countReactions(reactions: ReactionData[]): Map<string, number>`
- `hasUserReacted(reactions: ReactionData[], userPubkey: string, reactionContent?: string): boolean`
- `getUserReaction(reactions: ReactionData[], userPubkey: string): ReactionData | null`
- `getPopularReactions(reactions: ReactionData[], limit: number): Array<[string, number]>`

### Reaction Store (`/src/lib/stores/reactions.ts`)

#### Store Methods
```typescript
// Fetch reactions for messages
fetchReactions(messageIds: string[], relayUrl: string): Promise<void>

// Add reaction (with optimistic update)
addReaction(messageId: string, emoji: string, relayUrl: string, authorPubkey?: string): Promise<void>

// Remove user's reaction
removeReaction(messageId: string, relayUrl: string): Promise<void>

// Subscribe to real-time updates
subscribeToReactions(messageIds: string[], relayUrl: string): Promise<void>

// Get reaction summary for message
getReactionSummary(messageId: string): ReactionSummary

// Cleanup
unsubscribe(relayUrl: string): void
disconnectAll(): void
```

#### Derived Store
```typescript
getMessageReactions(messageId: string): Readable<ReactionSummary>
```

### Component Props

**ReactionBar.svelte:**
```typescript
export let messageId: string;
export let relayUrl: string = '';
export let authorPubkey: string = '';
```

**ReactionPicker.svelte:**
```typescript
export let show: boolean = false;

// Events
on:select - fired when reaction selected
on:close - fired when picker closed
```

**MessageItem.svelte (updated):**
```typescript
export let message: Message;
export let channelName: string | undefined = undefined;
export let messageElement: HTMLDivElement | undefined = undefined;
export let relayUrl: string = ''; // NEW
```

## Usage Example

```svelte
<script>
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import { reactionStore } from '$lib/stores/reactions';
  import { onMount } from 'svelte';

  const messages = [...]; // Your messages
  const relayUrl = 'wss://relay.example.com';

  onMount(async () => {
    // Fetch reactions for all messages
    const messageIds = messages.map(m => m.id);
    await reactionStore.fetchReactions(messageIds, relayUrl);

    // Subscribe to real-time updates
    await reactionStore.subscribeToReactions(messageIds, relayUrl);
  });
</script>

{#each messages as message}
  <MessageItem
    {message}
    {relayUrl}
  />
{/each}
```

## Technical Details

### Event Structure (NIP-25)
```json
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["e", "<message-event-id>"],
    ["p", "<message-author-pubkey>"]
  ],
  "created_at": 1234567890,
  "pubkey": "<reactor-pubkey>",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

### Reaction Normalization
- `+`, `👍`, `like` → `+` (CommonReactions.LIKE)
- `-`, `👎`, `dislike` → `-` (CommonReactions.DISLIKE)
- All other content preserved as-is

### Optimistic Updates Flow
1. User clicks reaction
2. Immediately update UI (optimistic reaction)
3. Create and publish event to relay
4. On success: replace optimistic with real reaction
5. On failure: remove optimistic reaction

### Real-Time Subscription
- Subscribe to kind 7 events for message IDs
- Filter by event ID ('e' tag)
- Deduplicate incoming reactions
- Update store reactively

## Performance Considerations

1. **Batch Fetching**: Fetch reactions for multiple messages in single subscription
2. **Optimistic Updates**: Instant UI feedback without waiting for relay
3. **Deduplication**: Prevent duplicate reactions from same user
4. **Lazy Loading**: Only fetch reactions when messages are visible
5. **Cleanup**: Automatically disconnect on page unload

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Tooltips for screen readers
- Semantic HTML structure
- Focus management in picker

## Mobile Support

- Touch-friendly reaction picker
- Responsive positioning (fixed on mobile, absolute on desktop)
- Larger touch targets (48px minimum)
- Swipe gestures supported

## Testing

Test coverage includes:
- Event creation and signing
- Event parsing and validation
- Reaction normalization
- Grouping and counting
- User reaction tracking
- Popular reactions
- Edge cases and error handling

Run tests:
```bash
npm test tests/reactions.test.ts
```

## Integration Checklist

To integrate reactions into a message list:

- [ ] Import `reactionStore` and `ReactionBar`
- [ ] Pass `relayUrl` prop to `MessageItem`
- [ ] Fetch reactions on mount: `reactionStore.fetchReactions()`
- [ ] Subscribe to updates: `reactionStore.subscribeToReactions()`
- [ ] Cleanup on unmount: `reactionStore.unsubscribe()`

## Future Enhancements

Potential improvements for future phases:

1. **Custom Emoji Picker**: Allow users to search/add any emoji
2. **Reaction Analytics**: Track most used reactions per channel
3. **Reaction Notifications**: Notify users when their messages get reactions
4. **Reaction Limits**: Prevent spam with rate limiting
5. **Reaction History**: View all reactions for a message
6. **Multi-Relay Support**: Aggregate reactions across multiple relays
7. **Reaction Persistence**: Cache reactions in IndexedDB
8. **Reaction Threads**: React to reactions (meta-reactions)

## Known Limitations

1. **Single Reaction Per User**: Current implementation allows only one reaction per user per message (can be changed)
2. **No Deletion**: NIP-25 doesn't specify reaction deletion (client-side only)
3. **No Relay Hints**: Could add relay hints for better propagation
4. **No Reaction Verification**: Trust relay to provide valid reactions

## Dependencies

- `nostr-tools`: Event creation, signing, verification
- `@noble/hashes/utils`: Hex encoding utilities
- `svelte/store`: Reactive state management
- `vitest`: Testing framework

## Related NIPs

- **NIP-01**: Basic protocol flow
- **NIP-25**: Reactions (this implementation)
- **NIP-10**: Event references (e tags)

## Support

For issues or questions:
- Check existing messages in the channel
- Review test cases for usage examples
- Consult NIP-25 specification: https://github.com/nostr-protocol/nips/blob/master/25.md

---

**Implementation Complete**: All Phase 1.6 requirements met ✅
