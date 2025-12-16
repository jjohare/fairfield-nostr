# PWA Implementation Guide

## Overview

Minimoonoir implements a complete Progressive Web App with offline support, background sync, and installability.

[Back to Main README](../README.md)

## Architecture

### Service Worker (`src/service-worker.ts`)

The service worker implements three caching strategies:

1. **Cache First** - Static assets (JS, CSS, HTML, icons)
   - Serves from cache immediately
   - Updates cache in background
   - Used for: `.js`, `.css`, `.html`, `.png`, `.svg`, fonts

2. **Network First** - API calls and dynamic content
   - Tries network first
   - Falls back to cache if offline
   - Used for: API endpoints, WebSocket connections

3. **Stale While Revalidate** - User profiles and avatars
   - Returns cached version immediately
   - Updates cache in background
   - Used for: `/avatar`, `/profile`, `/metadata`

### Offline Support

#### Message Queue

Messages sent while offline are queued in IndexedDB:

```typescript
interface QueuedMessage {
  id: string;
  timestamp: number;
  event: NostrEvent;
  relayUrls: string[];
}
```

Queue operations:
- `queueMessage(message)` - Add to queue
- `getQueuedMessages()` - Retrieve all queued
- `dequeueMessage(id)` - Remove from queue
- `clearQueue()` - Clear all messages

#### Background Sync

When connectivity is restored, the service worker automatically:
1. Detects online status
2. Retrieves queued messages
3. Sends to specified relays
4. Removes successfully sent messages
5. Notifies client of sync completion

### PWA Stores (`src/lib/stores/pwa.ts`)

Svelte stores for PWA state management:

```typescript
// Installation
installPrompt: Writable<BeforeInstallPromptEvent | null>
isPWAInstalled: Writable<boolean>
canInstall: Readable<boolean>

// Updates
updateAvailable: Writable<boolean>
swRegistration: Writable<ServiceWorkerRegistration | null>

// Connectivity
isOnline: Writable<boolean>

// Message queue
queuedMessageCount: Writable<number>
```

### Functions

#### Initialization

```typescript
import { initializePWA } from '$lib/utils/pwa-init';

// In your root component
onMount(() => {
  initializePWA();
});
```

#### Install App

```typescript
import { triggerInstall, canInstall } from '$lib/stores/pwa';

{#if $canInstall}
  <button on:click={triggerInstall}>
    Install App
  </button>
{/if}
```

#### Update Available

```typescript
import { updateAvailable, updateServiceWorker } from '$lib/stores/pwa';

{#if $updateAvailable}
  <button on:click={updateServiceWorker}>
    Update Available - Click to Reload
  </button>
{/if}
```

#### Offline Support

```typescript
import { sendMessageWithOfflineSupport } from '$lib/utils/pwa-init';

// Automatically queues if offline
await sendMessageWithOfflineSupport(
  nostrEvent,
  relayUrls,
  async (event, relays) => {
    // Your send logic
  }
);
```

#### Queue Management

```typescript
import {
  queuedMessageCount,
  getQueuedMessages,
  clearMessageQueue,
  triggerBackgroundSync
} from '$lib/stores/pwa';

// Show queue status
{#if $queuedMessageCount > 0}
  <p>{$queuedMessageCount} messages queued</p>
  <button on:click={triggerBackgroundSync}>Sync Now</button>
  <button on:click={clearMessageQueue}>Clear Queue</button>
{/if}
```

## Manifest (`static/manifest.json`)

PWA manifest configured with:

- **Name**: "Minimoonoir"
- **Display**: Standalone (fullscreen app experience)
- **Theme Color**: #16213e
- **Background Color**: #1a1a2e
- **Icons**: Multiple sizes (72x72 to 512x512)
- **Shortcuts**: Quick access to Messages and Profile
- **Share Target**: Accept shared text/URLs

### Required Assets

Create the following icon files in `static/`:

- `icon-72.png` (72x72)
- `icon-96.png` (96x96)
- `icon-128.png` (128x128)
- `icon-144.png` (144x144)
- `icon-152.png` (152x152)
- `icon-192.png` (192x192) - Required for PWA
- `icon-384.png` (384x384)
- `icon-512.png` (512x512) - Required for PWA

Recommended: Use consistent branding with theme colors.

## Integration Example

### Root Layout (`src/routes/+layout.svelte`)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    initializePWA,
    canInstall,
    triggerInstall,
    updateAvailable,
    updateServiceWorker,
    isOnline,
    queuedMessageCount
  } from '$lib/stores/pwa';

  onMount(() => {
    initializePWA();
  });
</script>

<!-- Install prompt -->
{#if $canInstall}
  <div class="install-banner">
    <p>Install Minimoonoir for offline access</p>
    <button on:click={triggerInstall}>Install</button>
  </div>
{/if}

<!-- Update notification -->
{#if $updateAvailable}
  <div class="update-banner">
    <p>Update available</p>
    <button on:click={updateServiceWorker}>Reload</button>
  </div>
{/if}

<!-- Offline indicator -->
{#if !$isOnline}
  <div class="offline-banner">
    <p>You're offline. Messages will be queued.</p>
    {#if $queuedMessageCount > 0}
      <p>{$queuedMessageCount} messages queued</p>
    {/if}
  </div>
{/if}

<slot />
```

### Message Send Handler

```typescript
import { sendMessageWithOfflineSupport } from '$lib/utils/pwa-init';
import { queueMessage, isOnline } from '$lib/stores/pwa';

async function sendMessage(content: string) {
  const event = {
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkey]],
    content: await encryptMessage(content),
    pubkey: senderPubkey
  };

  const relays = ['wss://relay.example.com'];

  await sendMessageWithOfflineSupport(event, relays, async (event, relays) => {
    // Your actual send implementation
    await nostrClient.send(event, relays);
  });
}
```

## Service Worker Events

The service worker communicates with the main thread via messages:

### From Client to Service Worker

```typescript
// Queue a message
navigator.serviceWorker.controller?.postMessage({
  type: 'QUEUE_MESSAGE',
  payload: queuedMessage
});

// Get queue
navigator.serviceWorker.controller?.postMessage({
  type: 'GET_QUEUE'
});

// Clear queue
navigator.serviceWorker.controller?.postMessage({
  type: 'CLEAR_QUEUE'
});

// Skip waiting (force update)
navigator.serviceWorker.controller?.postMessage({
  type: 'SKIP_WAITING'
});
```

### From Service Worker to Client

```typescript
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_COMPLETE') {
    console.log(`Synced ${event.data.count} messages`);
  }
});
```

## Testing

### Test Offline Functionality

1. Open Chrome DevTools
2. Go to Application > Service Workers
3. Check "Offline"
4. Send a message (should queue)
5. Uncheck "Offline"
6. Message should auto-sync

### Test Install

1. Open in Chrome/Edge
2. Look for install prompt
3. Click Install
4. App opens in standalone window

### Test Caching

1. Load app while online
2. Go offline
3. Navigate to cached pages
4. Should load from cache

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support (except install prompt)
- Safari: Partial support (no background sync)
- Mobile browsers: Full support on Android, partial on iOS

## Performance Considerations

### Cache Size Management

The service worker uses versioned caches:
- Old caches are cleared on activation
- Cache version bumps trigger full update

### IndexedDB Queue Limits

Consider implementing queue size limits:
- Maximum messages: 1000
- Maximum age: 7 days
- Auto-cleanup on sync

### Network Optimization

- Static assets cached indefinitely
- Dynamic content: 5-minute cache
- Profile data: stale-while-revalidate

## Security

### HTTPS Required

Service workers require HTTPS (except localhost):
- Development: http://localhost (allowed)
- Production: https://your-domain.com via Cloudflare (required)

### Same-Origin Policy

Service worker scope is limited to origin:
- Can only intercept same-origin requests
- Cross-origin requires CORS

### Content Security Policy

Update CSP headers:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               worker-src 'self';
               connect-src 'self' wss://*.nostr.com">
```

## Troubleshooting

### Service Worker Not Registering

- Check HTTPS (required except localhost)
- Check browser console for errors
- Verify service-worker.js is accessible

### Install Prompt Not Showing

- Must meet PWA criteria (HTTPS, manifest, service worker)
- User must visit site multiple times
- Chrome requires user engagement

### Messages Not Syncing

- Check Background Sync API support
- Verify service worker is active
- Check IndexedDB permissions

### Cache Not Updating

- Increment CACHE_VERSION
- Force reload (Ctrl+Shift+R)
- Clear cache in DevTools

## Future Enhancements

- Push notifications for new messages
- Periodic background sync
- Share target implementation
- Badge API for unread count
- File caching for media
- Predictive prefetching
