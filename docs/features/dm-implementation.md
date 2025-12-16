# NIP-17/NIP-59 Gift-Wrapped DM Implementation

[Back to Main README](../README.md)

## Overview

Complete implementation of privacy-preserving direct messages for Minimoonoir using:

- **NIP-17**: Private Direct Messages (sealed rumors)
- **NIP-59**: Gift Wraps (metadata protection)
- **NIP-44**: Versioned Encryption (modern, secure)

## Files

- `/src/lib/nostr/dm.ts` - Core implementation
- `/src/lib/nostr/dm.test.ts` - Comprehensive test suite
- `/examples/dm-usage.ts` - Usage examples

## API Reference

### `sendDM(content, recipientPubkey, senderPrivkey, relay)`

Sends a gift-wrapped direct message.

**Parameters:**
- `content: string` - Message content
- `recipientPubkey: string` - Recipient's public key (hex)
- `senderPrivkey: Uint8Array` - Sender's private key
- `relay: Relay` - Relay instance with `publish(event)` method

**Returns:** `Promise<void>`

**Example:**
```typescript
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { sendDM } from '$lib/nostr/dm';

const myPrivkey = generateSecretKey();
const recipientPubkey = '3bf0c63...';

await sendDM('Hello!', recipientPubkey, myPrivkey, relay);
```

### `receiveDM(giftWrapEvent, recipientPrivkey)`

Decrypts a received gift-wrapped DM.

**Parameters:**
- `giftWrapEvent: Event` - Kind 1059 event from relay
- `recipientPrivkey: Uint8Array` - Your private key

**Returns:** `DMContent | null`

**DMContent interface:**
```typescript
interface DMContent {
  content: string;        // Decrypted message
  senderPubkey: string;   // Real sender's pubkey
  timestamp: number;      // Real timestamp (seconds)
}
```

**Example:**
```typescript
import { receiveDM } from '$lib/nostr/dm';

const dm = receiveDM(event, myPrivkey);
if (dm) {
  console.log(`From ${dm.senderPubkey}: ${dm.content}`);
}
```

### `createDMFilter(recipientPubkey)`

Creates a relay subscription filter for receiving DMs.

**Parameters:**
- `recipientPubkey: string` - Your public key

**Returns:** `{ kinds: [1059], '#p': [pubkey] }`

**Example:**
```typescript
import { createDMFilter } from '$lib/nostr/dm';

const filter = createDMFilter(myPubkey);
relay.subscribe([filter], (event) => {
  const dm = receiveDM(event, myPrivkey);
  if (dm) handleNewDM(dm);
});
```

## Implementation Details

### Encryption Flow

```
1. Create Rumor (kind 14)
   ├─ pubkey: sender's real pubkey
   ├─ created_at: real timestamp
   ├─ content: plaintext message
   └─ tags: [["p", recipient]]

2. Seal Rumor (kind 13)
   ├─ Encrypt rumor with NIP-44
   ├─ Use sender→recipient conversation key
   └─ Sign with sender's privkey

3. Gift Wrap (kind 1059)
   ├─ Generate random keypair
   ├─ Fuzz timestamp (±2 days)
   ├─ Encrypt seal with random→recipient key
   ├─ pubkey: random (NOT sender)
   └─ created_at: fuzzed (NOT real time)

4. Publish to relay
   └─ Only kind 1059 visible on wire
```

### Privacy Guarantees

**Relay cannot determine:**
- ✅ Who sent the message (random pubkey used)
- ✅ When it was sent (timestamp fuzzed ±2 days)
- ✅ Message content (NIP-44 encrypted)
- ✅ Conversation threads (each msg uses new random key)

**Relay can determine:**
- ❌ Who receives it (p tag shows recipient)
- ❌ That it's a DM (kind 1059)

**Admin cannot:**
- ✅ Read message content (no recipient privkey)
- ✅ Link messages to sender (random pubkeys)
- ✅ Determine exact send time (fuzzed timestamps)

## Integration with SvelteKit

### Store Setup

```typescript
// src/lib/stores/dm.ts
import { writable, derived } from 'svelte/store';
import type { DMContent } from '$lib/nostr/dm';

interface DMConversation {
  pubkey: string;
  messages: (DMContent & { outgoing: boolean })[];
  unread: number;
}

export const conversations = writable<DMConversation[]>([]);
export const currentConversation = writable<string | null>(null);
```

### Component Usage

```svelte
<!-- src/components/chat/DMList.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ndk } from '$lib/stores/ndk';
  import { receiveDM, createDMFilter } from '$lib/nostr/dm';
  import { conversations } from '$lib/stores/dm';

  let userPrivkey: Uint8Array;
  let userPubkey: string;

  onMount(() => {
    // Subscribe to incoming DMs
    const filter = createDMFilter(userPubkey);
    const sub = $ndk.subscribe(filter);

    sub.on('event', (event) => {
      const dm = receiveDM(event.rawEvent(), userPrivkey);
      if (dm) {
        addToConversation(dm);
      }
    });

    return () => sub.stop();
  });
</script>
```

### Send Message Component

```svelte
<!-- src/components/chat/MessageInput.svelte -->
<script lang="ts">
  import { sendDM } from '$lib/nostr/dm';
  import { ndk } from '$lib/stores/ndk';

  export let recipientPubkey: string;
  export let senderPrivkey: Uint8Array;

  let message = '';

  async function send() {
    const relay = {
      publish: async (event) => {
        const ndkEvent = new NDKEvent($ndk, event);
        await ndkEvent.publish();
      }
    };

    await sendDM(message, recipientPubkey, senderPrivkey, relay);
    message = '';
  }
</script>

<input bind:value={message} placeholder="Type a message..." />
<button on:click={send}>Send</button>
```

## Testing

The implementation includes comprehensive tests covering:

- ✅ Gift wrap event creation (kind 1059)
- ✅ Random pubkey generation (sender anonymity)
- ✅ Timestamp fuzzing (±2 days)
- ✅ Content encryption (NIP-44)
- ✅ Successful decryption by recipient
- ✅ Failed decryption by wrong recipient
- ✅ Bidirectional communication
- ✅ Special characters and long messages
- ✅ Privacy guarantees (metadata protection)

Run tests:
```bash
npm test src/lib/nostr/dm.test.ts
```

## Security Considerations

### Key Management

- **Never** store private keys in plaintext
- Encrypt with user PIN/passphrase before localStorage
- Consider browser-based encryption (Web Crypto API)
- Use mnemonic backup (NIP-06) for key recovery

### Network Security

- Always use WSS (WebSocket Secure) for relay connections
- Verify relay SSL certificates
- Consider Tor for additional anonymity layer

### Metadata Leakage

- Gift wrap hides sender, but recipient is visible in p tag
- If Alice and Bob both tag each other, relay can infer conversation
- Consider using multiple relays to distribute metadata
- Future: implement gossip protocol for better privacy

### Forward Secrecy

- Current implementation does NOT provide forward secrecy
- If privkey is compromised, all past DMs can be decrypted
- Future consideration: implement Double Ratchet algorithm

## Comparison with Legacy NIP-04

| Feature | NIP-04 (Legacy) | NIP-17/59 (This) |
|---------|-----------------|------------------|
| Encryption | NIP-04 (insecure) | NIP-44 (modern) |
| Sender visible | Yes (pubkey in event) | No (random pubkey) |
| Timestamp | Real | Fuzzed (±2 days) |
| Metadata protection | None | Full gift wrap |
| Relay can link msgs | Yes | No |
| Admin can read | No | No |

## Performance Notes

- **Encryption cost**: ~2-5ms per message (modern CPU)
- **Random key generation**: ~1ms per message
- **Network overhead**: ~400-600 bytes per DM (encrypted)
- **Recommended limits**: Suitable for typical chat usage (<100 msgs/min)

## Future Enhancements

- [ ] Message reactions (using NIP-25)
- [ ] Read receipts (optional, privacy trade-off)
- [ ] Typing indicators (ephemeral events)
- [ ] File attachments (encrypt + upload to Blossom server)
- [ ] Forward secrecy (Double Ratchet)
- [ ] Multi-device sync (NIP-46 remote signing)

## References

- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [nostr-tools Documentation](https://github.com/nbd-wtf/nostr-tools)
