# NDK Relay Connection System

Complete implementation of Nostr relay connection with NIP-42 AUTH support.

## Features

- **NDK Integration**: Full NDK instance with Dexie cache adapter
- **NIP-42 AUTH**: Automatic authentication challenge handling
- **Connection Management**: State tracking and monitoring
- **Event Publishing**: Sign and publish events to relay
- **Subscriptions**: Create and manage event subscriptions
- **TypeScript**: Complete type safety

## Quick Start

```typescript
import { connectRelay, publishEvent, subscribe } from '$lib/nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

// Connect to relay
const privateKey = 'your-private-key-hex';
await connectRelay('ws://localhost:8080', privateKey);

// Publish a note
const event = new NDKEvent();
event.kind = 1;
event.content = 'Hello Nostr!';
await publishEvent(event);

// Subscribe to events
const subscription = subscribe({ kinds: [1], limit: 10 });
subscription.on('event', (event) => {
  console.log('Event:', event.content);
});
subscription.start();
```

## Connection States

The relay manager tracks these connection states:

- `disconnected` - Not connected to relay
- `connecting` - Connection in progress
- `connected` - Connected but not authenticated
- `auth-required` - Relay requesting authentication
- `authenticating` - AUTH challenge in progress
- `authenticated` - Successfully authenticated
- `auth-failed` - Authentication failed
- `error` - Connection error

## API Reference

### `connectRelay(relayUrl, privateKey)`

Connect to a Nostr relay with authentication.

**Parameters:**
- `relayUrl: string` - WebSocket URL (ws:// or wss://)
- `privateKey: string` - Private key in hex format

**Returns:** `Promise<ConnectionStatus>`

```typescript
const status = await connectRelay('ws://localhost:8080', privateKey);
console.log(status.state); // 'connected'
```

### `publishEvent(event)`

Sign and publish an event to the relay.

**Parameters:**
- `event: NDKEvent` - Event to publish

**Returns:** `Promise<boolean>` - True if published successfully

```typescript
const event = new NDKEvent();
event.kind = 1;
event.content = 'Hello!';
const success = await publishEvent(event);
```

### `subscribe(filters, opts?)`

Create a subscription for events matching filters.

**Parameters:**
- `filters: NDKFilter | NDKFilter[]` - Event filters
- `opts?: SubscriptionOptions` - Subscription options

**Returns:** `NDKSubscription`

```typescript
const sub = subscribe(
  { kinds: [1], authors: [pubkey] },
  { closeOnEose: false, subId: 'my-sub' }
);

sub.on('event', (event) => console.log(event));
sub.start();
```

### `disconnectRelay()`

Disconnect from relay and cleanup all subscriptions.

**Returns:** `Promise<void>`

```typescript
await disconnectRelay();
```

### `connectionState`

Svelte store for connection state monitoring.

```typescript
import { connectionState } from '$lib/nostr';

connectionState.subscribe(status => {
  console.log('State:', status.state);
  console.log('Authenticated:', status.authenticated);
});
```

### `getCurrentUser()`

Get the current authenticated user.

**Returns:** `Promise<NDKUser | null>`

```typescript
const user = await getCurrentUser();
console.log('Pubkey:', user?.pubkey);
```

## Configuration

Create a `.env` file with:

```bash
VITE_RELAY_URL=ws://localhost:8080
VITE_ADMIN_PUBKEY=your-admin-pubkey-hex
VITE_NDK_DEBUG=false
```

Import configuration:

```typescript
import { RELAY_URL, ADMIN_PUBKEY, NDK_CONFIG } from '$lib/config';
```

## NIP-42 Authentication

The relay manager automatically handles NIP-42 AUTH challenges:

1. Relay sends AUTH challenge
2. State changes to `auth-required`
3. Manager creates kind 22242 event
4. Event signed with user's private key
5. AUTH message sent to relay
6. State changes to `authenticated` on success

## Cache Adapter

Uses Dexie (IndexedDB) for event caching:

```typescript
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

// Automatic cache initialization
const cache = new NDKCacheAdapterDexie({
  dbName: 'fairfield-nostr-cache',
  expirationTime: 3600 * 24 * 7 // 7 days
});
```

## Error Handling

All async operations can throw errors:

```typescript
try {
  await connectRelay(relayUrl, privateKey);
} catch (error) {
  console.error('Connection failed:', error);
}
```

Monitor connection errors via state:

```typescript
connectionState.subscribe(status => {
  if (status.state === 'error') {
    console.error('Error:', status.error);
  }
});
```

## Examples

See `/home/devuser/workspace/fairfield-nostr/src/lib/nostr/examples.ts` for complete examples:

- Basic connection
- Publishing notes
- Subscribing to events
- Publishing metadata
- Reacting to events
- Multiple subscriptions
- Connection monitoring
- Complete workflow

## File Structure

```
src/lib/
├── config.ts          # Environment configuration
├── index.ts           # Main exports
└── nostr/
    ├── relay.ts       # Relay connection manager
    ├── types.ts       # TypeScript definitions
    ├── index.ts       # Nostr module exports
    ├── examples.ts    # Usage examples
    └── README.md      # This file
```

## Dependencies

- `@nostr-dev-kit/ndk` - Core NDK library
- `@nostr-dev-kit/ndk-cache-dexie` - Dexie cache adapter
- `@nostr-dev-kit/ndk-svelte` - Svelte integration
- `svelte` - Reactive stores

## License

Part of Fairfield Nostr project.
