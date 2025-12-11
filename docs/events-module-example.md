# Nostr Events Module Examples

## Installation

```bash
npm install nostr-tools @noble/hashes
```

## Basic Usage

### Creating Events

```typescript
import {
  createChannelMessage,
  createUserMetadata,
  createTextNote,
  createReaction,
  EventKind,
} from '$lib/nostr';

// Channel message (kind 9)
const channelEvent = createChannelMessage(
  'Hello, channel!',
  'channel-event-id',
  privateKey
);

// User metadata (kind 0)
const profileEvent = createUserMetadata(
  {
    name: 'Alice',
    about: 'Nostr enthusiast',
    picture: 'https://example.com/avatar.jpg',
  },
  privateKey
);

// Text note (kind 1)
const noteEvent = createTextNote('Hello, Nostr!', privateKey);

// Reply to a note
const replyEvent = createTextNote(
  'Great post!',
  privateKey,
  'event-id-to-reply-to'
);

// Reaction (kind 7)
const reactionEvent = createReaction(
  'event-id',
  'author-pubkey',
  privateKey,
  '+'
);
```

### Signing and Verification

```typescript
import { signEvent, verifyEventSignature } from '$lib/nostr';

// Sign an event template
const eventTemplate = {
  kind: EventKind.TEXT_NOTE,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'My message',
};

const signedEvent = signEvent(eventTemplate, privateKey);

// Verify event signature
const isValid = verifyEventSignature(signedEvent);
console.log('Valid signature:', isValid);
```

### Parsing Events

```typescript
import {
  parseChannelMessage,
  parseUserMetadata,
  getEventTags,
  getEventTag,
} from '$lib/nostr';

// Parse channel message
const channelData = parseChannelMessage(event);
if (channelData) {
  console.log('Content:', channelData.content);
  console.log('Channel ID:', channelData.channelId);
  console.log('Author:', channelData.author);
}

// Parse user metadata
const profile = parseUserMetadata(metadataEvent);
if (profile) {
  console.log('Name:', profile.name);
  console.log('About:', profile.about);
}

// Get all tags of type 'e'
const eventRefs = getEventTags(event, 'e');
console.log('Referenced events:', eventRefs);

// Get first tag of type 'p'
const mention = getEventTag(event, 'p');
console.log('Mentioned user:', mention);
```

### NIP-19 Encoding/Decoding

```typescript
import {
  npubEncode,
  npubDecode,
  noteEncode,
  noteDecode,
  nsecEncode,
  nsecDecode,
} from '$lib/nostr';

// Encode/decode npub (public key)
const npub = npubEncode(pubkeyHex);
const pubkey = npubDecode(npub);

// Encode/decode note (event ID)
const note = noteEncode(eventId);
const eventId = noteDecode(note);

// Encode/decode nsec (private key)
const nsec = nsecEncode(privkeyHex);
const privkey = nsecDecode(nsec);
```

### Event Filters

```typescript
import {
  channelMessagesFilter,
  userMetadataFilter,
  dmFilter,
  textNotesFilter,
} from '$lib/nostr';

// Get messages from a channel
const channelFilter = channelMessagesFilter(
  'channel-id',
  Math.floor(Date.now() / 1000) - 3600, // last hour
  100 // limit
);

// Get metadata for multiple users
const metadataFilter = userMetadataFilter([
  'pubkey1',
  'pubkey2',
  'pubkey3',
]);

// Get DMs for a user
const dmFilter = dmFilter(userPubkey);

// Get text notes from authors
const notesFilter = textNotesFilter(['author1', 'author2']);
```

### Timestamp Utilities

```typescript
import {
  nowSeconds,
  formatRelativeTime,
  formatAbsoluteTime,
  isRecent,
} from '$lib/nostr';

// Current timestamp
const now = nowSeconds();

// Format relative time
const relative = formatRelativeTime(event.created_at);
// Output: "5 mins ago", "2 hours ago", etc.

// Format absolute time
const absolute = formatAbsoluteTime(event.created_at);
// Output: "12/11/2025, 10:30:00 AM"

// Check if event is recent (within last 5 minutes)
const recent = isRecent(event.created_at, 300);
```

### Event Validation

```typescript
import {
  isValidEventStructure,
  isValidEvent,
  eventReferences,
  eventMentions,
  isReply,
} from '$lib/nostr';

// Check event structure
const hasValidStructure = isValidEventStructure(event);

// Validate and verify signature
const isValid = isValidEvent(event);

// Check if event references another event
const references = eventReferences(event, 'target-event-id');

// Check if event mentions a user
const mentions = eventMentions(event, 'target-pubkey');

// Check if event is a reply
const isReplyPost = isReply(event);
```

## Complete Example: Creating and Publishing a Channel Message

```typescript
import {
  createChannelMessage,
  verifyEventSignature,
  formatRelativeTime,
  parseChannelMessage,
} from '$lib/nostr';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';

// Generate keys (in real app, load from secure storage)
const secretKey = generateSecretKey();
const privkey = bytesToHex(secretKey);
const pubkey = getPublicKey(secretKey);

// Create a channel message
const event = createChannelMessage(
  'Hello, everyone!',
  'my-channel-id',
  privkey
);

// Verify the event
console.log('Event valid:', verifyEventSignature(event));

// Parse the event
const parsed = parseChannelMessage(event);
if (parsed) {
  console.log('Message:', parsed.content);
  console.log('Posted:', formatRelativeTime(parsed.timestamp));
}

// Publish to relay (pseudo-code)
// relay.publish(event);
```

## Type Definitions

```typescript
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface UserProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
}

interface ChannelMessage {
  content: string;
  channelId: string;
  author: string;
  timestamp: number;
  eventId: string;
  tags: string[][];
}

interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [key: \`#\${string}\`]: string[] | undefined;
}
```

## Event Kinds Reference

```typescript
const EventKind = {
  METADATA: 0,              // User metadata
  TEXT_NOTE: 1,             // Text note
  RECOMMEND_RELAY: 2,       // Relay recommendation
  CONTACTS: 3,              // Contact list
  ENCRYPTED_DM: 4,          // Encrypted direct message
  DELETION: 5,              // Event deletion
  REPOST: 6,                // Repost
  REACTION: 7,              // Reaction
  BADGE_AWARD: 8,           // Badge award
  CHANNEL_MESSAGE: 9,       // Channel message
  CHANNEL_CREATE: 40,       // Channel creation
  CHANNEL_METADATA: 41,     // Channel metadata
  CHANNEL_HIDE_MESSAGE: 43, // Hide channel message
  CHANNEL_MUTE_USER: 44,    // Mute user in channel
  ZAP_REQUEST: 9734,        // Zap request
  ZAP_RECEIPT: 9735,        // Zap receipt
  LONG_FORM: 30023,         // Long-form content
  APP_SPECIFIC: 30078,      // Application-specific data
};
```
