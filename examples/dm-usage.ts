/**
 * Example usage of NIP-17/NIP-59 Gift-Wrapped Direct Messages
 *
 * This demonstrates how to send and receive private DMs using the dm.ts module.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { sendDM, receiveDM, createDMFilter, type Relay } from '../src/lib/nostr/dm';

/**
 * Example: Sending a gift-wrapped DM
 */
async function exampleSendDM() {
  // Generate sender's keypair (in real app, restore from mnemonic)
  const senderPrivkey = generateSecretKey();
  const senderPubkey = getPublicKey(senderPrivkey);

  // Recipient's public key (obtained from their profile)
  const recipientPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'; // Example

  // Message content
  const message = 'Hello! This is a private message.';

  // Mock relay (replace with actual NDK or nostr-tools relay)
  const relay: Relay = {
    publish: async (event) => {
      console.log('Publishing gift-wrapped DM:', event.id);
      // In real app: await relay.publish(event)
    },
  };

  try {
    await sendDM(message, recipientPubkey, senderPrivkey, relay);
    console.log('DM sent successfully!');
  } catch (error) {
    console.error('Failed to send DM:', error);
  }
}

/**
 * Example: Receiving and decrypting DMs
 */
async function exampleReceiveDM() {
  // Your keypair
  const myPrivkey = generateSecretKey();
  const myPubkey = getPublicKey(myPrivkey);

  // Create subscription filter for your DMs
  const filter = createDMFilter(myPubkey);
  console.log('Subscription filter:', filter);
  // Output: { kinds: [1059], '#p': ['your-pubkey'] }

  // Mock received event (in real app, from relay subscription)
  const receivedEvent = {
    id: 'abc123',
    kind: 1059,
    pubkey: 'random-pubkey-from-gift-wrap',
    created_at: 1702500000,
    tags: [['p', myPubkey]],
    content: 'encrypted-blob',
    sig: 'signature',
  };

  // Decrypt the DM
  const dm = receiveDM(receivedEvent, myPrivkey);

  if (dm) {
    console.log('New DM received!');
    console.log('From:', dm.senderPubkey);
    console.log('Message:', dm.content);
    console.log('Sent at:', new Date(dm.timestamp * 1000).toISOString());
  } else {
    console.log('Failed to decrypt DM (wrong recipient or corrupted)');
  }
}

/**
 * Example: Full DM conversation flow
 */
async function exampleConversation() {
  // Alice and Bob generate their keypairs
  const alicePrivkey = generateSecretKey();
  const alicePubkey = getPublicKey(alicePrivkey);

  const bobPrivkey = generateSecretKey();
  const bobPubkey = getPublicKey(bobPrivkey);

  console.log('Alice pubkey:', alicePubkey);
  console.log('Bob pubkey:', bobPubkey);

  // Mock relay that stores events
  let lastEvent: any = null;
  const relay: Relay = {
    publish: async (event) => {
      lastEvent = event;
      console.log(`Event ${event.id} published`);
    },
  };

  // Step 1: Alice sends DM to Bob
  console.log('\n--- Alice sends to Bob ---');
  await sendDM('Hey Bob, want to grab coffee?', bobPubkey, alicePrivkey, relay);

  // Step 2: Bob receives and decrypts
  console.log('\n--- Bob receives ---');
  const bobReceives = receiveDM(lastEvent, bobPrivkey);
  if (bobReceives) {
    console.log('Bob sees:', bobReceives.content);
    console.log('From:', bobReceives.senderPubkey === alicePubkey ? 'Alice' : 'Unknown');
  }

  // Step 3: Bob replies to Alice
  console.log('\n--- Bob replies to Alice ---');
  await sendDM('Sure! How about 2pm?', alicePubkey, bobPrivkey, relay);

  // Step 4: Alice receives Bob's reply
  console.log('\n--- Alice receives ---');
  const aliceReceives = receiveDM(lastEvent, alicePrivkey);
  if (aliceReceives) {
    console.log('Alice sees:', aliceReceives.content);
    console.log('From:', aliceReceives.senderPubkey === bobPubkey ? 'Bob' : 'Unknown');
  }

  // Privacy guarantees
  console.log('\n--- Privacy Check ---');
  console.log('Gift wrap pubkey:', lastEvent.pubkey);
  console.log('Is it Bob?', lastEvent.pubkey === bobPubkey ? 'LEAK!' : 'No (good)');
  console.log('Is it Alice?', lastEvent.pubkey === alicePubkey ? 'LEAK!' : 'No (good)');
  console.log('Timestamp fuzzed:', lastEvent.created_at !== Math.floor(Date.now() / 1000));
}

/**
 * Example: Integration with NDK (SvelteKit app)
 */
async function exampleNDKIntegration() {
  // Pseudo-code for SvelteKit + NDK integration

  /*
  import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { sendDM, receiveDM } from '$lib/nostr/dm';

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: ['wss://relay.fairfield.example.com']
  });
  await ndk.connect();

  // Get user's keys from store
  const userPrivkey = $authStore.privateKey; // Uint8Array
  const userPubkey = getPublicKey(userPrivkey);

  // Send DM
  const relay = {
    publish: async (event) => {
      const ndkEvent = new NDKEvent(ndk, event);
      await ndkEvent.publish();
    }
  };

  await sendDM('Hello!', recipientPubkey, userPrivkey, relay);

  // Subscribe to incoming DMs
  const filter = createDMFilter(userPubkey);
  const sub = ndk.subscribe(filter);

  sub.on('event', (event: NDKEvent) => {
    const dm = receiveDM(event.rawEvent(), userPrivkey);
    if (dm) {
      // Add to UI
      addMessageToUI(dm);
    }
  });
  */

  console.log('See code comments for NDK integration example');
}

/**
 * Example: Privacy analysis
 */
function examplePrivacyAnalysis() {
  console.log('\n=== NIP-17/NIP-59 Privacy Guarantees ===\n');

  console.log('1. Metadata Protection:');
  console.log('   - Relay sees: random pubkey (not sender)');
  console.log('   - Relay sees: fuzzed timestamp (±2 days)');
  console.log('   - Relay sees: only recipient in p tag');
  console.log('   - Relay sees: encrypted blob (no content)\n');

  console.log('2. What Relay CANNOT determine:');
  console.log('   - Who sent the message (random pubkey)');
  console.log('   - When it was sent (timestamp fuzzed)');
  console.log('   - Message content (NIP-44 encrypted)');
  console.log('   - Conversation threads (each msg has new random key)\n');

  console.log('3. What Relay CAN determine:');
  console.log('   - Who receives it (p tag shows recipient)');
  console.log('   - That it is a DM (kind 1059)\n');

  console.log('4. Triple encryption layers:');
  console.log('   Layer 1: Rumor content encrypted to recipient (NIP-44)');
  console.log('   Layer 2: Rumor signed and sealed by sender');
  console.log('   Layer 3: Seal encrypted with random key for gift wrap\n');

  console.log('5. Admin cannot read DMs:');
  console.log('   - Admin runs relay but does not have recipient private key');
  console.log('   - Cannot decrypt any layer without recipient privkey');
  console.log('   - Can only see that DMs are being sent to recipient\n');
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Gift-Wrapped DM Examples ===\n');

  examplePrivacyAnalysis();

  console.log('\n--- Running conversation example ---\n');
  exampleConversation().catch(console.error);
}

export {
  exampleSendDM,
  exampleReceiveDM,
  exampleConversation,
  exampleNDKIntegration,
  examplePrivacyAnalysis,
};
