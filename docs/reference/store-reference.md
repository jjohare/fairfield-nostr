---
title: Store Reference
description: Consolidated reference for all Svelte store APIs managing application state in Nostr-BBS
category: reference
tags: [api, development, ui]
---

# Store Reference

**Version:** 1.0.0
**Date:** 2025-12-20
**Status:** Production

[← Back to Documentation Hub](../INDEX.md) | [← Back to API Reference](api-reference.md)

---

## Overview

This document consolidates all Svelte store APIs used throughout Nostr-BBS. Stores manage application state reactively and provide the foundation for the UI layer.

---

## Table of Contents

1. [Core Stores](#core-stores)
2. [Authentication & User](#authentication--user)
3. [Channel Management](#channel-management)
4. [Messaging](#messaging)
5. [Notifications](#notifications)
6. [PWA & Offline](#pwa--offline)
7. [UI State](#ui-state)
8. [Preferences](#preferences)

---

## Core Stores

### Store Index

**Location:** `/src/lib/stores/index.ts`

Central export point for all stores.

```typescript
// Authentication
export { authStore } from './auth';
export type { AuthState } from './auth';

// User management
export {
  userStore,
  whitelistStatusStore,
  isAuthenticated,
  isAdmin,
  isAdminVerified,
  isApproved,
  currentPubkey,
  currentCohorts,
  currentDisplayName
} from './user';

// Notifications
export {
  notificationStore,
  unreadNotifications,
  unreadCount,
  recentNotifications,
  shouldNotify
} from './notifications';

// PWA
export {
  installPrompt,
  updateAvailable,
  isOnline,
  swRegistration,
  isPWAInstalled,
  queuedMessageCount,
  canInstall,
  initPWA,
  triggerInstall
} from './pwa';

// Mute
export {
  muteStore,
  mutedCount,
  mutedUsersList,
  createIsMutedStore
} from './mute';

// Sections
export {
  sectionStore,
  accessibleSections,
  pendingSections,
  pendingRequestCount,
  canSeeChannel
} from './sections';
```

---

## Authentication & User

### authStore

**Location:** `/src/lib/stores/auth.ts`

Core authentication state.

#### State Interface

```typescript
interface AuthState {
  publicKey: string | null;
  isAuthenticated: boolean;
  displayName?: string;
}
```

#### Usage

```typescript
import { authStore } from '$lib/stores';

// Subscribe to auth state
authStore.subscribe(state => {
  console.log('Authenticated:', state.isAuthenticated);
  console.log('Public Key:', state.publicKey);
});

// Update auth state
authStore.set({
  publicKey: '7f8e...',
  isAuthenticated: true,
  displayName: 'Alice'
});
```

---

### userStore

**Location:** `/src/lib/stores/user.ts`

Extended user profile and permissions.

#### State Interface

```typescript
interface UserProfile {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud16?: string; // Lightning address
}

interface UserState {
  profile: UserProfile | null;
  cohorts: CohortType[];
  globalRole: RoleId;
  sectionRoles: UserSectionRole[];
  permissions: string[];
}

type RoleId = 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';
type CohortType = 'cohort-a' | 'cohort-b' | 'cohort-c';
```

#### Derived Stores

```typescript
// Check if user is authenticated
isAuthenticated: Readable<boolean>

// Check if user has admin role
isAdmin: Readable<boolean>

// Check if admin privileges verified on relay
isAdminVerified: Readable<boolean>

// Check if user approved on whitelist
isApproved: Readable<boolean>

// Current user's public key
currentPubkey: Readable<string | null>

// User's cohort memberships
currentCohorts: Readable<CohortType[]>

// Display name (fallback to pubkey)
currentDisplayName: Readable<string>
```

#### Example Usage

```typescript
import {
  userStore,
  isAdmin,
  currentCohorts,
  currentDisplayName
} from '$lib/stores';

// Subscribe to admin status
$: if ($isAdmin) {
  console.log('User is admin');
}

// Check cohort membership
$: hasAccess = $currentCohorts.includes('cohort-a');

// Display user name
console.log('Welcome,', $currentDisplayName);
```

---

### whitelistStatusStore

**Location:** `/src/lib/stores/user.ts`

Whitelist approval status.

```typescript
interface WhitelistStatus {
  approved: boolean;
  source: 'relay' | 'local' | 'pending' | 'none';
  checkedAt: number;
  error?: string;
}

// Usage
whitelistStatusStore.subscribe(status => {
  if (status.approved) {
    console.log('User approved via', status.source);
  } else if (status.source === 'pending') {
    console.log('Approval pending...');
  }
});
```

---

## Channel Management

### channelStore

**Location:** `/src/lib/stores/channelStore.ts`

Channel and message state management.

#### State Interface

```typescript
interface Channel {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'cohort' | 'invite';
  cohorts: string[];
  encrypted: boolean;
  section: ChannelSection;
  admins: string[];
  members: string[];
  pendingRequests: string[];
  createdAt: number;
  creatorPubkey: string;
}

interface Message {
  id: string;
  channelId: string;
  content: string;
  author: string;
  timestamp: number;
  replyTo?: string;
  mentions: string[];
  encrypted: boolean;
}

interface JoinRequest {
  channelId: string;
  requesterPubkey: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

type MemberStatus = 'admin' | 'member' | 'pending' | 'non-member';

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
// Channel management
channelStore.setChannels(channels: Channel[]): void
channelStore.addChannel(channel: Channel): void
channelStore.selectChannel(channelId: string | null): void

// Message management
channelStore.setMessages(channelId: string, messages: Message[]): void
channelStore.addMessage(message: Message): void
channelStore.deleteMessage(channelId: string, messageId: string): void

// Membership
channelStore.requestJoin(channelId: string, requesterPubkey: string): void
channelStore.getMemberStatus(
  channelId: string,
  userPubkey: string | null
): MemberStatus

// Loading state
channelStore.setLoading(isLoading: boolean): void
```

#### Derived Stores

```typescript
// Currently selected channel
getSelectedChannel(): Readable<Channel | null>

// Messages for selected channel
getSelectedMessages(): Readable<Message[]>

// Current user's membership status in selected channel
getUserMemberStatus(): Readable<MemberStatus>
```

#### Example Usage

```typescript
import {
  channelStore,
  getSelectedChannel,
  getSelectedMessages,
  getUserMemberStatus
} from '$lib/stores';

// Select a channel
channelStore.selectChannel('channel-id');

// Display selected channel
$: selectedChannel = getSelectedChannel();
console.log('Current channel:', $selectedChannel?.name);

// Display messages
$: messages = getSelectedMessages();
$: sortedMessages = $messages.sort((a, b) => a.timestamp - b.timestamp);

// Check membership
$: memberStatus = getUserMemberStatus();
$: canPost = $memberStatus === 'member' || $memberStatus === 'admin';

// Add message
channelStore.addMessage({
  id: 'msg-123',
  channelId: 'channel-id',
  content: 'Hello!',
  author: userPubkey,
  timestamp: Date.now() / 1000,
  mentions: [],
  encrypted: false
});
```

---

### channelsStore (Channels List)

**Location:** `/src/lib/stores/channels.ts`

Manages available channels list.

```typescript
interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

// Methods
channelsStore.fetchChannels(): Promise<void>
channelsStore.addChannel(channel: Channel): void
channelsStore.removeChannel(channelId: string): void
channelsStore.updateChannel(channelId: string, updates: Partial<Channel>): void
```

---

### sectionStore

**Location:** `/src/lib/stores/sections.ts`

Section access and permissions.

```typescript
interface SectionAccessStatus {
  sectionId: SectionId;
  canAccess: boolean;
  role: RoleId;
  status: 'approved' | 'pending' | 'denied' | 'not-requested';
  requestedAt?: number;
}

interface SectionState {
  accesses: SectionAccessStatus[];
  loading: boolean;
}

// Derived stores
accessibleSections: Readable<SectionAccessStatus[]>
pendingSections: Readable<SectionAccessStatus[]>
pendingRequestCount: Readable<number>
canSeeChannel: (channelId: string) => Readable<boolean>
```

---

## Messaging

### messagesStore

**Location:** `/src/lib/stores/messages.ts`

Message state and subscriptions.

```typescript
interface MessageState {
  messages: Record<string, Message[]>;
  subscriptions: Record<string, () => void>;
  loading: Record<string, boolean>;
}

// Methods
messagesStore.subscribe(channelId: string): void
messagesStore.unsubscribe(channelId: string): void
messagesStore.addMessage(message: Message): void
messagesStore.removeMessage(channelId: string, messageId: string): void
messagesStore.getMessages(channelId: string): Message[]
```

---

### dmStore

**Location:** `/src/lib/stores/dm.ts`

Direct message conversations.

```typescript
interface DMConversation {
  peerPubkey: string;
  messages: DMMessage[];
  unreadCount: number;
  lastMessageAt: number;
}

interface DMMessage {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  read: boolean;
}

interface DMState {
  conversations: Record<string, DMConversation>;
  selectedPeer: string | null;
  loading: boolean;
}

// Methods
dmStore.selectConversation(peerPubkey: string): void
dmStore.sendMessage(recipient: string, content: string): Promise<void>
dmStore.markAsRead(peerPubkey: string): void

// Derived stores
totalUnreadDMs: Readable<number>
activeConversations: Readable<DMConversation[]>
selectedConversation: Readable<DMConversation | null>
```

---

### reactionsStore

**Location:** `/src/lib/stores/reactions.ts`

Event reactions management.

```typescript
interface Reaction {
  eventId: string;
  content: string; // Emoji or '+'
  pubkey: string;
  timestamp: number;
}

interface ReactionState {
  reactions: Record<string, Reaction[]>;
}

// Methods
reactionsStore.addReaction(reaction: Reaction): void
reactionsStore.removeReaction(eventId: string, pubkey: string): void
reactionsStore.getReactions(eventId: string): Reaction[]
reactionsStore.getReactionCounts(eventId: string): Record<string, number>

// Example
const counts = reactionsStore.getReactionCounts('event-123');
// { '+': 42, '❤️': 15, '😂': 8 }
```

---

### replyStore

**Location:** `/src/lib/stores/reply.ts`

Reply/threading state.

```typescript
interface ReplyState {
  replyingTo: {
    eventId: string;
    content: string;
    author: string;
  } | null;
}

// Methods
replyStore.setReply(eventId: string, content: string, author: string): void
replyStore.clearReply(): void

// Usage
replyStore.setReply('msg-123', 'Original message', 'pubkey');
// ... user writes reply ...
replyStore.clearReply();
```

---

### draftsStore

**Location:** `/src/lib/stores/drafts.ts`

Message draft persistence.

```typescript
interface Draft {
  content: string;
  timestamp: number;
}

interface DraftState {
  drafts: Record<string, Draft>; // Keyed by channelId
}

// Methods
draftsStore.saveDraft(channelId: string, content: string): void
draftsStore.loadDraft(channelId: string): string | null
draftsStore.clearDraft(channelId: string): void

// Auto-save example
let typingTimer: ReturnType<typeof setTimeout>;
function onInput(content: string) {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    draftsStore.saveDraft(channelId, content);
  }, 1000); // Save after 1s of inactivity
}
```

---

### pinnedMessagesStore

**Location:** `/src/lib/stores/pinnedMessages.ts`

Pinned messages per channel.

```typescript
interface PinnedMessage {
  messageId: string;
  channelId: string;
  content: string;
  author: string;
  pinnedAt: number;
  pinnedBy: string;
}

interface PinnedMessageState {
  pinned: Record<string, PinnedMessage[]>; // Keyed by channelId
}

// Methods
pinnedMessagesStore.pin(message: Message, channelId: string): Promise<void>
pinnedMessagesStore.unpin(messageId: string, channelId: string): Promise<void>
pinnedMessagesStore.getPinned(channelId: string): PinnedMessage[]
```

---

## Notifications

### notificationStore

**Location:** `/src/lib/stores/notifications.ts`

User notification management.

```typescript
type NotificationType =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'dm'
  | 'channel_invite'
  | 'join_request_approved'
  | 'admin_message';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
  eventId?: string;
  senderPubkey?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationState {
  notifications: Notification[];
  enabled: boolean;
  lastCheck: number;
}

// Methods
notificationStore.add(notification: Omit<Notification, 'id'>): void
notificationStore.markAsRead(notificationId: string): void
notificationStore.markAllAsRead(): void
notificationStore.remove(notificationId: string): void
notificationStore.clear(): void
notificationStore.setEnabled(enabled: boolean): void
```

#### Derived Stores

```typescript
// Unread notifications
unreadNotifications: Readable<Notification[]>

// Count of unread
unreadCount: Readable<number>

// Recent notifications (last 10)
recentNotifications: Readable<Notification[]>

// Whether to show notification badge
shouldNotify: Readable<boolean>
```

#### Example Usage

```typescript
import {
  notificationStore,
  unreadCount,
  recentNotifications
} from '$lib/stores';

// Add notification
notificationStore.add({
  type: 'mention',
  message: '@alice mentioned you',
  timestamp: Date.now(),
  read: false,
  eventId: 'event-123',
  senderPubkey: 'alice-pubkey'
});

// Show badge
$: if ($unreadCount > 0) {
  document.title = `(${$unreadCount}) Nostr BBS`;
}

// Display recent
{#each $recentNotifications as notif}
  <div on:click={() => notificationStore.markAsRead(notif.id)}>
    {notif.message}
  </div>
{/each}
```

---

## PWA & Offline

### PWA Stores

**Location:** `/src/lib/stores/pwa.ts`

Progressive Web App state and capabilities.

```typescript
interface PWAState {
  installPrompt: BeforeInstallPromptEvent | null;
  updateAvailable: boolean;
  isOnline: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  queuedMessages: QueuedMessage[];
}

interface QueuedMessage {
  id: string;
  channelId: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

// Writable stores
installPrompt: Writable<BeforeInstallPromptEvent | null>
updateAvailable: Writable<boolean>
isOnline: Writable<boolean>
swRegistration: Writable<ServiceWorkerRegistration | null>

// Derived stores
isPWAInstalled: Readable<boolean>
queuedMessageCount: Readable<number>
canInstall: Readable<boolean>
```

#### Methods

```typescript
// Initialize PWA
initPWA(): void

// Trigger installation prompt
triggerInstall(): Promise<void>

// Service worker registration
registerServiceWorker(): Promise<void>
updateServiceWorker(): Promise<void>

// Offline message queue
queueMessage(message: QueuedMessage): void
getQueuedMessages(): QueuedMessage[]
clearMessageQueue(): void
triggerBackgroundSync(): Promise<void>
```

#### Example Usage

```typescript
import {
  initPWA,
  triggerInstall,
  isOnline,
  queuedMessageCount,
  canInstall
} from '$lib/stores';

// Initialize on app load
onMount(() => {
  initPWA();
});

// Install button
$: if ($canInstall) {
  showInstallButton = true;
}

async function install() {
  await triggerInstall();
}

// Offline indicator
$: if (!$isOnline) {
  showOfflineBanner = true;
}

// Queued message count
$: queuedCount = $queuedMessageCount;
console.log(`${queuedCount} messages queued`);
```

---

## UI State

### toastStore

**Location:** `/src/lib/stores/toast.ts`

Toast notification system.

```typescript
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  dismissible: boolean;
}

interface ToastState {
  toasts: Toast[];
}

// Methods
toastStore.show(
  message: string,
  type?: ToastType,
  duration?: number
): void

toastStore.success(message: string, duration?: number): void
toastStore.error(message: string, duration?: number): void
toastStore.warning(message: string, duration?: number): void
toastStore.info(message: string, duration?: number): void

toastStore.dismiss(toastId: string): void
```

#### Example Usage

```typescript
import { toastStore } from '$lib/stores';

// Show toast
toastStore.success('Message sent!', 3000);
toastStore.error('Failed to connect', 5000);

// Manual control
const toast = toastStore.show('Processing...', 'info', 0); // 0 = no auto-dismiss
// ... later ...
toastStore.dismiss(toast.id);
```

---

### confirmStore

**Location:** `/src/lib/stores/confirm.ts`

Confirmation dialog management.

```typescript
interface ConfirmDialog {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmState {
  dialog: ConfirmDialog | null;
}

// Methods
confirmStore.show(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean>

confirmStore.confirm(): void
confirmStore.cancel(): void
```

#### Example Usage

```typescript
import { confirmStore } from '$lib/stores';

async function deleteMessage() {
  const confirmed = await confirmStore.show({
    title: 'Delete Message',
    message: 'Are you sure? This cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  if (confirmed) {
    await doDelete();
  }
}
```

---

### muteStore

**Location:** `/src/lib/stores/mute.ts`

User muting functionality.

```typescript
interface MutedUser {
  pubkey: string;
  mutedAt: number;
  reason?: string;
  expiresAt?: number; // Optional temporary mute
}

interface MuteState {
  mutedUsers: Map<string, MutedUser>;
}

// Methods
muteStore.mute(pubkey: string, reason?: string, duration?: number): void
muteStore.unmute(pubkey: string): void
muteStore.isMuted(pubkey: string): boolean
muteStore.getMutedUser(pubkey: string): MutedUser | undefined

// Derived stores
mutedCount: Readable<number>
mutedUsersList: Readable<MutedUser[]>

// Factory for reactive mute check
createIsMutedStore(pubkey: string): Readable<boolean>
```

#### Example Usage

```typescript
import { muteStore, mutedCount, createIsMutedStore } from '$lib/stores';

// Mute user
muteStore.mute('spammer-pubkey', 'Spam', 24 * 60 * 60 * 1000); // 24h mute

// Check if muted (non-reactive)
if (muteStore.isMuted('pubkey')) {
  console.log('User is muted');
}

// Reactive mute check
const isMuted = createIsMutedStore('pubkey');
$: if ($isMuted) {
  hideContent = true;
}

// Show mute count
console.log(`${$mutedCount} users muted`);
```

---

### linkPreviewsStore

**Location:** `/src/lib/stores/linkPreviews.ts`

Link preview cache.

```typescript
interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  fetchedAt: number;
}

interface LinkPreviewState {
  previews: Map<string, LinkPreview>;
  loading: Set<string>;
}

// Methods
linkPreviewsStore.fetch(url: string): Promise<LinkPreview | null>
linkPreviewsStore.get(url: string): LinkPreview | undefined
linkPreviewsStore.isLoading(url: string): boolean
```

---

## Preferences

### settingsStore

**Location:** `/src/lib/stores/settings.ts`

User application settings.

```typescript
interface Settings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showAvatars: boolean;
  showLinkPreviews: boolean;
  playNotificationSound: boolean;
  enableHaptics: boolean;
  autoLoadImages: boolean;
  maxMessagesPerChannel: number;
  defaultChannelView: 'list' | 'grid';
}

// Methods
settingsStore.update(updates: Partial<Settings>): void
settingsStore.reset(): void
settingsStore.export(): string
settingsStore.import(json: string): void
```

#### Example Usage

```typescript
import { settingsStore } from '$lib/stores';

// Subscribe to settings
settingsStore.subscribe(settings => {
  document.body.classList.toggle('compact', settings.compactMode);
  document.documentElement.style.fontSize = fontSizes[settings.fontSize];
});

// Update setting
settingsStore.update({ theme: 'dark' });
```

---

### preferencesStore

**Location:** `/src/lib/stores/preferences.ts`

Channel-specific preferences.

```typescript
interface ChannelPreferences {
  notifications: boolean;
  sound: boolean;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
}

interface PreferencesState {
  channels: Record<string, ChannelPreferences>;
}

// Methods
preferencesStore.set(channelId: string, prefs: Partial<ChannelPreferences>): void
preferencesStore.get(channelId: string): ChannelPreferences
preferencesStore.toggle(channelId: string, key: keyof ChannelPreferences): void
```

---

## Admin Stores

### adminStore

**Location:** `/src/lib/stores/admin.ts`

Admin dashboard state.

```typescript
interface AdminState {
  joinRequests: JoinRequest[];
  reportedMessages: Report[];
  stats: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    activeUsers24h: number;
  };
  loading: boolean;
}

interface JoinRequest {
  id: string;
  channelId: string;
  requesterPubkey: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface Report {
  id: string;
  messageId: string;
  reportedBy: string;
  reason: string;
  timestamp: number;
  resolved: boolean;
}

// Methods
adminStore.fetchJoinRequests(): Promise<void>
adminStore.approveJoinRequest(requestId: string): Promise<void>
adminStore.rejectJoinRequest(requestId: string): Promise<void>
adminStore.fetchReports(): Promise<void>
adminStore.resolveReport(reportId: string): Promise<void>
adminStore.fetchStats(): Promise<void>
```

---

## Store Patterns

### 1. Subscription Pattern

```typescript
// Component lifecycle
onMount(() => {
  const unsubscribe = someStore.subscribe(value => {
    console.log('Store updated:', value);
  });

  return () => {
    unsubscribe();
  };
});
```

---

### 2. Derived Store Pattern

```typescript
import { derived } from 'svelte/store';

// Create derived store
const filteredMessages = derived(
  [messagesStore, currentChannel],
  ([$messages, $channel]) => {
    return $messages.filter(m => m.channelId === $channel);
  }
);

// Use in component
$: messages = $filteredMessages;
```

---

### 3. Custom Store Pattern

```typescript
function createCustomStore() {
  const { subscribe, set, update } = writable(initialValue);

  return {
    subscribe,
    customMethod: () => update(n => n + 1),
    reset: () => set(initialValue)
  };
}

export const customStore = createCustomStore();
```

---

### 4. Store Persistence Pattern

```typescript
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function persistentStore<T>(key: string, initial: T) {
  const stored = browser ? localStorage.getItem(key) : null;
  const data = stored ? JSON.parse(stored) : initial;

  const store = writable<T>(data);

  store.subscribe(value => {
    if (browser) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  return store;
}

export const settings = persistentStore('settings', defaultSettings);
```

---

## Related Documentation

- [API Reference](api-reference.md) - Function and API documentation
- [Component Reference](component-reference.md) - Component props and usage
- [Features Documentation](../features/) - Feature-specific guides

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-20
**Maintained by:** Frontend Team
