---
title: API Reference
description: Comprehensive API reference for all endpoints, functions, and interfaces in Nostr-BBS
category: reference
tags: [api, relay, search, authentication]
---

# API Reference

**Version:** 1.0.0
**Date:** 2025-12-20
**Status:** Production

[← Back to Documentation Hub](../INDEX.md)

---

## Overview

This document consolidates all API endpoints, functions, and interfaces available in the Nostr-BBS application. It serves as the single source of truth for API documentation.

---

## Table of Contents

1. [Server API Endpoints](#server-api-endpoints)
2. [Nostr Library API](#nostr-library-api)
3. [Store APIs](#store-apis)
4. [Utility APIs](#utility-apis)
5. [Semantic Search API](#semantic-search-api)

---

## Server API Endpoints

### Link Preview Proxy API

**Endpoint:** `/api/proxy`

Server-side proxy for fetching link previews with CORS bypass and intelligent caching.

#### GET /api/proxy

Fetch link preview metadata for a URL.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Target URL to fetch preview for |
| `stats` | boolean | No | If `true`, returns cache statistics instead |

**Response Format:**

```typescript
// OpenGraph Preview
{
  type: 'opengraph',
  url: string,
  domain: string,
  favicon: string,
  title?: string,
  description?: string,
  image?: string,
  siteName?: string,
  cached: boolean
}

// Twitter/X Preview
{
  type: 'twitter',
  url: string,
  html: string,
  author_name: string,
  author_url: string,
  provider_name: string,
  width: number,
  cached: boolean
}

// Cache Statistics
{
  size: number,
  totalHits: number
}
```

**Headers:**

- **Request:**
  - `Accept: text/html,application/xhtml+xml` (for OpenGraph)
  - `Accept: application/json` (for Twitter oEmbed)

- **Response:**
  - `Content-Type: application/json`
  - `Cache-Control: public, max-age=86400` (24h for OpenGraph, 1h for Twitter)
  - `X-Cache: HIT|MISS` (cache status indicator)

**Example Usage:**

```typescript
// Fetch link preview
const response = await fetch('/api/proxy?url=' + encodeURIComponent(url));
const preview = await response.json();

// Get cache statistics
const stats = await fetch('/api/proxy?stats=true');
const { size, totalHits } = await stats.json();
```

**Caching Behavior:**

- **OpenGraph previews:** Cached for 10 days
- **Twitter/X previews:** Cached for 1 day
- **Max cache size:** 1000 entries (LRU eviction)
- **Server-side caching:** Shared across all users

**Error Responses:**

```typescript
// 400 Bad Request
{
  error: 'Missing url parameter' | 'Invalid URL'
}

// 500 Internal Server Error
{
  error: string // Error message
}
```

**Special Features:**

1. **Twitter/X Detection:** Automatically uses Twitter oEmbed API for twitter.com/x.com URLs
2. **OpenGraph Fallback:** Falls back to Twitter Card metadata if OpenGraph tags missing
3. **URL Resolution:** Handles relative image/favicon URLs correctly
4. **HTML Entity Decoding:** Properly decodes HTML entities in metadata
5. **Timeout Protection:** 10-second timeout for external requests

---

## Nostr Library API

### Event Management

#### Event Creation Functions

**Location:** `/src/lib/nostr/events.ts`

##### createChannelMessage()

Create a channel message event (kind 9).

```typescript
function createChannelMessage(
  content: string,
  channelId: string,
  privkey: string
): NostrEvent
```

**Parameters:**
- `content` - Message text content
- `channelId` - Channel identifier (event ID of channel creation event)
- `privkey` - Hex-encoded private key

**Returns:** Signed Nostr event (kind 9)

**Tags Added:**
- `['e', channelId, '', 'root']` - Channel reference

---

##### createUserMetadata()

Create user metadata event (kind 0).

```typescript
function createUserMetadata(
  profile: UserProfile,
  privkey: string
): NostrEvent
```

**Parameters:**
- `profile` - User profile data object
  ```typescript
  interface UserProfile {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
  }
  ```
- `privkey` - Hex-encoded private key

**Returns:** Signed metadata event (kind 0)

---

##### createDeletionEvent()

Create event deletion request (kind 5, NIP-09).

```typescript
function createDeletionEvent(
  eventIds: string[],
  privkey: string,
  reason?: string
): NostrEvent
```

**Parameters:**
- `eventIds` - Array of event IDs to delete
- `privkey` - Hex-encoded private key
- `reason` - Optional deletion reason

**Returns:** Signed deletion event (kind 5)

**Tags Added:**
- `['e', eventId]` for each event to delete

---

##### createReaction()

Create reaction event (kind 7, NIP-25).

```typescript
function createReaction(
  eventId: string,
  authorPubkey: string,
  privkey: string,
  reaction: string = '+'
): NostrEvent
```

**Parameters:**
- `eventId` - Event ID to react to
- `authorPubkey` - Public key of event author
- `privkey` - Hex-encoded private key
- `reaction` - Reaction content (default: "+", or emoji)

**Returns:** Signed reaction event (kind 7)

**Tags Added:**
- `['e', eventId]` - Event reference
- `['p', authorPubkey]` - Author reference

---

#### Event Verification

##### verifyEventSignature()

Verify event signature according to NIP-01.

```typescript
function verifyEventSignature(event: NostrEvent): boolean
```

**Parameters:**
- `event` - Event to verify

**Returns:** `true` if signature is valid

**Verification Process:**
1. Compute event ID hash from content
2. Compare computed ID with event.id
3. Verify schnorr signature against event ID

**Note:** Always performs fresh verification (no caching) to detect tampering.

---

#### NIP-19 Encoding/Decoding

##### npubEncode() / npubDecode()

Encode/decode public keys (npub format).

```typescript
function npubEncode(hexPubkey: string): string
function npubDecode(npub: string): string
```

---

##### nsecEncode() / nsecDecode()

Encode/decode private keys (nsec format).

```typescript
function nsecEncode(hexPrivkey: string): string
function nsecDecode(nsec: string): string
```

**⚠️ Security Warning:** Handle nsec with extreme care. Never log or transmit.

---

##### noteEncode() / noteDecode()

Encode/decode event IDs (note format).

```typescript
function noteEncode(eventId: string): string
function noteDecode(note: string): string
```

---

##### neventEncode() / nprofileEncode()

Encode event/profile with relay hints.

```typescript
function neventEncode(
  eventId: string,
  relays?: string[],
  author?: string
): string

function nprofileEncode(
  pubkey: string,
  relays?: string[]
): string
```

---

#### Event Filters

##### channelMessagesFilter()

Filter for channel messages.

```typescript
function channelMessagesFilter(
  channelId: string,
  since?: number,
  limit: number = 100
): Filter
```

**Returns:**
```typescript
{
  kinds: [9],
  '#e': [channelId],
  since?: number,
  limit: number
}
```

---

##### dmFilter()

Filter for direct messages.

```typescript
function dmFilter(
  userPubkey: string,
  since?: number,
  limit: number = 50
): Filter
```

**Returns:**
```typescript
{
  kinds: [4], // NIP-04 encrypted DMs
  '#p': [userPubkey],
  since?: number,
  limit: number
}
```

---

##### reactionsFilter()

Filter for reactions to an event.

```typescript
function reactionsFilter(
  eventId: string,
  limit: number = 100
): Filter
```

**Returns:**
```typescript
{
  kinds: [7],
  '#e': [eventId],
  limit: number
}
```

---

### Channel Management

**Location:** `/src/lib/nostr/channels.ts`

#### Channel Event Kinds (NIP-28)

```typescript
const CHANNEL_KINDS = {
  CREATE: 40,       // Channel creation
  METADATA: 41,     // Channel metadata
  MESSAGE: 42,      // Channel message
  HIDE_MESSAGE: 43, // Hide message
  MUTE_USER: 44     // Mute user in channel
}
```

---

#### createChannel()

Create a new public chat channel (NIP-28).

```typescript
async function createChannel(
  options: ChannelCreateOptions
): Promise<CreatedChannel>
```

**Parameters:**
```typescript
interface ChannelCreateOptions {
  name: string;
  description?: string;
  visibility?: 'public' | 'cohort' | 'private';
  cohorts?: string[];
  encrypted?: boolean;
  section?: ChannelSection;
}
```

**Returns:**
```typescript
interface CreatedChannel {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'cohort' | 'private';
  cohorts: string[];
  encrypted: boolean;
  section: ChannelSection;
  createdAt: number;
  creatorPubkey: string;
}
```

**Throws:**
- `Error` if browser environment not available
- `Error` if no signer configured
- `Error` if channel name invalid
- `RateLimitError` if rate limit exceeded

**Rate Limits:**
- Channel creation: Limited to prevent spam

**Validation:**
- Channel name must pass `validateChannelName()`

**Tags Added:**
- `['visibility', visibility]` - If not public
- `['cohort', cohorts]` - Comma-separated cohort list
- `['encrypted', 'true']` - If encrypted
- `['section', section]` - Section identifier

---

#### sendChannelMessage()

Send message to a channel.

```typescript
async function sendChannelMessage(
  channelId: string,
  content: string,
  options?: {
    replyTo?: string;
    mentions?: string[];
  }
): Promise<NDKEvent>
```

**Parameters:**
- `channelId` - Target channel ID
- `content` - Message text
- `options.replyTo` - Optional parent message ID (threading)
- `options.mentions` - Optional array of mentioned pubkeys

**Returns:** Published NDKEvent

**Tags Added:**
- `['e', channelId, '', 'root']` - Channel reference
- `['e', replyTo, '', 'reply']` - Reply reference (if provided)
- `['p', pubkey]` - Mention tags (for each mention)

**Content Validation:**
- Must pass `validateContent()` check
- Rate limited per user

---

### Direct Message API

**Location:** `/src/lib/nostr/dm.ts`

#### sendDM()

Send encrypted direct message (NIP-17 + NIP-59).

```typescript
async function sendDM(
  recipientPubkey: string,
  content: string
): Promise<void>
```

**Parameters:**
- `recipientPubkey` - Recipient's public key (hex)
- `content` - Message plaintext

**Encryption Flow:**
1. Encrypt content with NIP-44
2. Create sealed rumor (kind 14, NIP-17)
3. Wrap with gift-wrap (kind 1059, NIP-59)
4. Publish to relay

**Privacy Features:**
- Random sender key (metadata hiding)
- Fuzzed timestamp (±2 days)
- Encrypted content (NIP-44 v2)

---

#### receiveDM()

Subscribe to incoming direct messages.

```typescript
function receiveDM(
  recipientPubkey: string,
  onMessage: (dm: DecryptedDM) => void
): () => void
```

**Parameters:**
- `recipientPubkey` - User's public key (hex)
- `onMessage` - Callback for each received DM

**Returns:** Unsubscribe function

**Callback Payload:**
```typescript
interface DecryptedDM {
  content: string;
  sender: string;
  timestamp: number;
  id: string;
}
```

---

### Calendar API

**Location:** `/src/lib/nostr/calendar.ts`

#### Calendar Event Kinds (NIP-52)

```typescript
const CALENDAR_EVENT_KIND = 31923; // Time-based calendar event
const RSVP_KIND = 31925;           // Event RSVP
```

---

#### createCalendarEvent()

Create calendar event (NIP-52).

```typescript
async function createCalendarEvent(
  event: {
    title: string;
    description?: string;
    start: number;
    end?: number;
    location?: string;
    channelId?: string;
  }
): Promise<NDKEvent>
```

**Parameters:**
- `title` - Event title
- `description` - Optional description
- `start` - Unix timestamp (seconds)
- `end` - Optional end timestamp
- `location` - Optional location string
- `channelId` - Optional channel association

**Returns:** Published calendar event

**Tags Added:**
- `['d', uniqueId]` - Replaceable event identifier
- `['title', title]`
- `['start', start.toString()]`
- `['end', end.toString()]` (if provided)
- `['location', location]` (if provided)
- `['h', channelId]` (if provided)

---

#### rsvpToEvent()

RSVP to a calendar event.

```typescript
async function rsvpToEvent(
  eventId: string,
  status: 'accepted' | 'declined' | 'tentative'
): Promise<NDKEvent>
```

**Parameters:**
- `eventId` - Calendar event ID
- `status` - RSVP status

**Returns:** Published RSVP event (kind 31925)

---

### Encryption API

**Location:** `/src/lib/nostr/encryption.ts`

#### encryptChannelMessage()

Encrypt message for private channel (NIP-44).

```typescript
async function encryptChannelMessage(
  content: string,
  recipientPubkeys: string[],
  senderPrivkey: string
): Promise<string>
```

**Parameters:**
- `content` - Plaintext message
- `recipientPubkeys` - Array of member public keys
- `senderPrivkey` - Sender's private key

**Returns:** Encrypted payload (NIP-44 format)

**Encryption Process:**
1. For each recipient, compute shared secret
2. Encrypt content with NIP-44 v2 (ChaCha20-Poly1305)
3. Return ciphertext blob

---

#### decryptChannelMessage()

Decrypt private channel message.

```typescript
function decryptChannelMessage(
  encryptedContent: string,
  senderPubkey: string,
  recipientPrivkey: string
): string
```

**Parameters:**
- `encryptedContent` - Ciphertext from event.content
- `senderPubkey` - Sender's public key
- `recipientPrivkey` - Recipient's private key

**Returns:** Decrypted plaintext

**Throws:** Error if decryption fails (not a valid recipient)

---

## Store APIs

### Channel Store

**Location:** `/src/lib/stores/channelStore.ts`

Manages channel state, messages, and membership.

#### Interface

```typescript
interface ChannelState {
  channels: Channel[];
  messages: Record<string, Message[]>;
  selectedChannelId: string | null;
  joinRequests: JoinRequest[];
  isLoading: boolean;
}
```

#### Methods

```typescript
channelStore.setChannels(channels: Channel[]): void
channelStore.addChannel(channel: Channel): void
channelStore.selectChannel(channelId: string | null): void
channelStore.setMessages(channelId: string, messages: Message[]): void
channelStore.addMessage(message: Message): void
channelStore.deleteMessage(channelId: string, messageId: string): void
channelStore.requestJoin(channelId: string, requesterPubkey: string): void
channelStore.getMemberStatus(channelId: string, userPubkey: string | null): MemberStatus
channelStore.setLoading(isLoading: boolean): void
```

#### Derived Stores

```typescript
// Selected channel (reactive)
getSelectedChannel(): Readable<Channel | null>

// Messages for selected channel
getSelectedMessages(): Readable<Message[]>

// Current user's membership status
getUserMemberStatus(): Readable<MemberStatus>
```

---

### Authentication Store

**Location:** `/src/lib/stores/auth.ts`

Manages user authentication state.

```typescript
interface AuthState {
  publicKey: string | null;
  isAuthenticated: boolean;
  displayName?: string;
}

authStore.subscribe(callback: (state: AuthState) => void)
```

---

### User Store

**Location:** `/src/lib/stores/user.ts`

**Exported Stores:**
```typescript
userStore: Writable<UserState>
whitelistStatusStore: Writable<WhitelistStatus>

// Derived stores
isAuthenticated: Readable<boolean>
isAdmin: Readable<boolean>
isAdminVerified: Readable<boolean>
isApproved: Readable<boolean>
currentPubkey: Readable<string | null>
currentCohorts: Readable<CohortType[]>
currentDisplayName: Readable<string>
```

---

### Notification Store

**Location:** `/src/lib/stores/notifications.ts`

**Interface:**
```typescript
interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
  eventId?: string;
  senderPubkey?: string;
}

type NotificationType =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'dm'
  | 'channel_invite';
```

**Derived Stores:**
```typescript
unreadNotifications: Readable<Notification[]>
unreadCount: Readable<number>
recentNotifications: Readable<Notification[]> // Last 10
shouldNotify: Readable<boolean>
```

---

### PWA Store

**Location:** `/src/lib/stores/pwa.ts`

Progressive Web App state management.

**Stores:**
```typescript
installPrompt: Writable<BeforeInstallPromptEvent | null>
updateAvailable: Writable<boolean>
isOnline: Writable<boolean>
swRegistration: Writable<ServiceWorkerRegistration | null>
isPWAInstalled: Readable<boolean>
queuedMessageCount: Readable<number>
canInstall: Readable<boolean>
```

**Methods:**
```typescript
initPWA(): void
triggerInstall(): Promise<void>
registerServiceWorker(): Promise<void>
updateServiceWorker(): Promise<void>
queueMessage(message: QueuedMessage): void
getQueuedMessages(): QueuedMessage[]
clearMessageQueue(): void
triggerBackgroundSync(): Promise<void>
```

---

### Mute Store

**Location:** `/src/lib/stores/mute.ts`

User muting functionality.

```typescript
interface MutedUser {
  pubkey: string;
  mutedAt: number;
  reason?: string;
}

muteStore.subscribe(callback: (state: MuteState) => void)

// Derived stores
mutedCount: Readable<number>
mutedUsersList: Readable<MutedUser[]>

// Factory for reactive mute check
createIsMutedStore(pubkey: string): Readable<boolean>
```

---

## Utility APIs

### Validation

**Location:** `/src/lib/utils/validation.ts`

```typescript
function validateContent(content: string): ValidationResult
function validateChannelName(name: string): ValidationResult

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

**Content Validation Rules:**
- Max length: 10,000 characters
- No null bytes
- Valid UTF-8 encoding

**Channel Name Rules:**
- Min length: 3 characters
- Max length: 50 characters
- Allowed: alphanumeric, spaces, hyphens, underscores
- No leading/trailing whitespace

---

### Rate Limiting

**Location:** `/src/lib/utils/rateLimit.ts`

```typescript
function checkRateLimit(
  action: 'channelCreate' | 'message' | 'dm'
): RateLimitResult

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds
}

class RateLimitError extends Error {
  retryAfter: number;
}
```

**Rate Limits:**
- Channel creation: 5 per hour
- Messages: 60 per minute
- DMs: 30 per minute

---

### Storage

**Location:** `/src/lib/utils/storage.ts`

Secure key storage with encryption.

```typescript
function saveKeys(keys: StoredKeys): Promise<void>
function loadKeys(): Promise<StoredKeys | null>
function clearKeys(): Promise<void>
function hasStoredKeys(): Promise<boolean>
function getStoredPubkey(): Promise<string | null>

interface StoredKeys {
  privateKey: string; // Encrypted with user password
  publicKey: string;
  mnemonic?: string; // BIP39 mnemonic (encrypted)
}
```

**Security Features:**
- AES-256-GCM encryption
- Password-derived key (PBKDF2, 100k iterations)
- Salt stored with encrypted data
- IndexedDB storage (encrypted at rest)

---

## Semantic Search API

**Location:** `/src/lib/semantic/index.ts`

### Embedding Sync

```typescript
async function syncEmbeddings(): Promise<void>
async function initEmbeddingSync(): Promise<void>
async function fetchManifest(): Promise<EmbeddingManifest>
function shouldSync(): boolean
function getLocalSyncState(): SyncState | null

interface EmbeddingManifest {
  version: string;
  lastUpdated: number;
  fileCount: number;
  totalSize: number;
  files: {
    name: string;
    size: number;
    hash: string;
  }[];
}
```

**Sync Strategy:**
- Check manifest every 6 hours
- Download only changed files (hash comparison)
- Store in IndexedDB for offline access
- Automatic retry on failure

---

### HNSW Search

```typescript
async function loadIndex(): Promise<void>
async function searchSimilar(
  query: string,
  limit?: number
): Promise<SearchResult[]>
function isSearchAvailable(): boolean
function getSearchStats(): SearchStats
async function unloadIndex(): Promise<void>

interface SearchResult {
  messageId: string;
  content: string;
  similarity: number; // 0-1
  channelId: string;
  timestamp: number;
}

interface SearchStats {
  indexLoaded: boolean;
  vectorCount: number;
  dimensions: number;
  memoryUsage: number; // bytes
}
```

**Search Features:**
- HNSW index (Hierarchical Navigable Small World)
- 150x faster than brute force
- Cosine similarity scoring
- Configurable result limit (default: 20)

**Performance:**
- Index load time: ~500ms (50k messages)
- Search latency: <50ms
- Memory usage: ~5MB per 10k messages

---

## Type Definitions

### Nostr Types

**Location:** `/src/lib/nostr/types.ts`

```typescript
enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  AuthRequired = 'auth-required',
  Authenticating = 'authenticating',
  Authenticated = 'authenticated',
  AuthFailed = 'auth-failed',
  Error = 'error'
}

interface ConnectionStatus {
  state: ConnectionState;
  relay?: string;
  error?: string;
  timestamp: number;
  authenticated: boolean;
}

interface RelayStats {
  url: string;
  connected: boolean;
  authenticated: boolean;
  activeSubscriptions: number;
  eventsPublished: number;
  eventsReceived: number;
}
```

---

### Config Types

**Location:** `/src/lib/config/types.ts`

```typescript
type RoleId = 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';
type CohortId = string;
type SectionId = string;
type CalendarAccessLevel = 'full' | 'availability' | 'cohort' | 'none';
type ChannelVisibility = 'public' | 'cohort' | 'invite';

interface SectionConfig {
  id: SectionId;
  name: string;
  description: string;
  icon: string;
  order: number;
  access: SectionAccessConfig;
  features: SectionFeaturesConfig;
  ui: SectionUIConfig;
}

interface UserPermissions {
  pubkey: string;
  cohorts: CohortId[];
  globalRole: RoleId;
  sectionRoles: UserSectionRole[];
}
```

---

## Error Handling

### Standard Error Types

```typescript
// Rate Limiting
class RateLimitError extends Error {
  retryAfter: number; // seconds
}

// Validation
interface ValidationError {
  field: string;
  message: string;
  code: 'INVALID_LENGTH' | 'INVALID_FORMAT' | 'REQUIRED';
}

// Connection
class ConnectionError extends Error {
  relay: string;
  state: ConnectionState;
}

// Encryption
class EncryptionError extends Error {
  algorithm: 'NIP-44' | 'NIP-17';
  operation: 'encrypt' | 'decrypt';
}
```

---

## Best Practices

### API Usage Patterns

#### 1. Event Creation

```typescript
// Always verify signer before creating events
if (!hasSigner()) {
  throw new Error('Please login first');
}

// Validate input before creating event
const validation = validateContent(content);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}

// Check rate limits
const rateLimit = checkRateLimit('message');
if (!rateLimit.allowed) {
  throw new RateLimitError('Rate limit exceeded', rateLimit.retryAfter);
}

// Create and publish
const event = await sendChannelMessage(channelId, content);
```

---

#### 2. Store Subscription

```typescript
// Subscribe to store updates
const unsubscribe = channelStore.subscribe(state => {
  console.log('Channels:', state.channels);
});

// Always cleanup on component destroy
onDestroy(() => {
  unsubscribe();
});
```

---

#### 3. Error Handling

```typescript
try {
  await sendDM(recipientPubkey, message);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry in ${error.retryAfter}s`);
  } else if (error instanceof EncryptionError) {
    console.error('Encryption failed:', error.algorithm);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Related Documentation

- [NIP Protocol Reference](nip-protocol-reference.md) - Nostr protocol specifications
- [Component Reference](component-reference.md) - UI component API
- [Store Reference](store-reference.md) - Complete store documentation
- [Configuration Reference](configuration-reference.md) - App configuration

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-20
**Maintained by:** Documentation Team
