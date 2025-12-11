/**
 * NIP-17/NIP-59 Gift-Wrapped Direct Messages
 *
 * Implements privacy-preserving direct messages using:
 * - NIP-17: Private Direct Messages (sealed rumors)
 * - NIP-59: Gift Wraps (random sender keys, fuzzed timestamps)
 * - NIP-44: Versioned Encryption
 */

import {
  type Event,
  type UnsignedEvent,
  nip44,
  generateSecretKey,
  getPublicKey,
  finalizeEvent
} from 'nostr-tools';

/** Kind for sealed rumor (NIP-17) */
const KIND_SEALED_RUMOR = 14;

/** Kind for gift wrap (NIP-59) */
const KIND_GIFT_WRAP = 1059;

/** Kind for seal event */
const KIND_SEAL = 13;

/** Two days in seconds for timestamp fuzzing */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/**
 * Result of unwrapping a DM
 */
export interface DMContent {
  /** Decrypted message content */
  content: string;
  /** Public key of the actual sender */
  senderPubkey: string;
  /** Real timestamp of the message */
  timestamp: number;
}

/**
 * Simple relay interface for publishing events
 */
export interface Relay {
  publish(event: Event): Promise<void>;
}

/**
 * Send a gift-wrapped direct message
 *
 * @param content - The message content to send
 * @param recipientPubkey - Recipient's public key (hex)
 * @param senderPrivkey - Sender's private key (hex)
 * @param relay - Relay instance to publish to
 *
 * @example
 * ```typescript
 * const privkey = generateSecretKey();
 * const recipientPubkey = "abc123...";
 *
 * await sendDM(
 *   "Hello, this is a private message!",
 *   recipientPubkey,
 *   privkey,
 *   relay
 * );
 * ```
 */
export async function sendDM(
  content: string,
  recipientPubkey: string,
  senderPrivkey: Uint8Array,
  relay: Relay
): Promise<void> {
  const senderPubkey = getPublicKey(senderPrivkey);
  const currentTimestamp = Math.floor(Date.now() / 1000);

  // Step 1: Create the rumor (unsigned inner event - kind 14)
  const rumor: UnsignedEvent = {
    kind: KIND_SEALED_RUMOR,
    pubkey: senderPubkey,
    created_at: currentTimestamp,
    tags: [['p', recipientPubkey]],
    content: content,
  };

  // Step 2: Encrypt the rumor with NIP-44 for the recipient (creating the seal)
  const senderRecipientKey = nip44.v2.utils.getConversationKey(
    senderPrivkey,
    recipientPubkey
  );

  const sealedRumorContent = nip44.v2.encrypt(
    JSON.stringify(rumor),
    senderRecipientKey
  );

  // Create the seal event (kind 13)
  const seal: UnsignedEvent = {
    kind: KIND_SEAL,
    pubkey: senderPubkey,
    created_at: currentTimestamp,
    tags: [],
    content: sealedRumorContent,
  };

  const signedSeal = finalizeEvent(seal, senderPrivkey);

  // Step 3: Generate random keypair for gift wrap
  const randomPrivkey = generateSecretKey();
  const randomPubkey = getPublicKey(randomPrivkey);

  // Step 4: Fuzz timestamp by ±2 days
  const fuzzOffset = Math.floor(Math.random() * (2 * TWO_DAYS_SECONDS)) - TWO_DAYS_SECONDS;
  const fuzzedTimestamp = currentTimestamp + fuzzOffset;

  // Step 5: Encrypt the seal with the random key for the recipient
  const randomRecipientKey = nip44.v2.utils.getConversationKey(
    randomPrivkey,
    recipientPubkey
  );

  const giftWrapContent = nip44.v2.encrypt(
    JSON.stringify(signedSeal),
    randomRecipientKey
  );

  // Step 6: Create the gift wrap event (kind 1059)
  const giftWrap: UnsignedEvent = {
    kind: KIND_GIFT_WRAP,
    pubkey: randomPubkey,  // Random public key, not the sender!
    created_at: fuzzedTimestamp,  // Fuzzed timestamp
    tags: [['p', recipientPubkey]],  // Only recipient is visible
    content: giftWrapContent,
  };

  const signedGiftWrap = finalizeEvent(giftWrap, randomPrivkey);

  // Step 7: Publish the gift-wrapped event
  await relay.publish(signedGiftWrap);
}

/**
 * Receive and unwrap a gift-wrapped direct message
 *
 * @param giftWrapEvent - The kind 1059 event received from relay
 * @param recipientPrivkey - Recipient's private key (hex)
 * @returns Decrypted message content and metadata, or null if decryption fails
 *
 * @example
 * ```typescript
 * const myPrivkey = generateSecretKey();
 *
 * // Received from relay subscription
 * const result = receiveDM(giftWrapEvent, myPrivkey);
 *
 * if (result) {
 *   console.log(`Message from ${result.senderPubkey}: ${result.content}`);
 * }
 * ```
 */
export function receiveDM(
  giftWrapEvent: Event,
  recipientPrivkey: Uint8Array
): DMContent | null {
  try {
    // Step 1: Verify this is a gift wrap event
    if (giftWrapEvent.kind !== KIND_GIFT_WRAP) {
      return null;
    }

    // Step 2: Unwrap the gift (decrypt kind 1059 with random sender's pubkey)
    const wrapConversationKey = nip44.v2.utils.getConversationKey(
      recipientPrivkey,
      giftWrapEvent.pubkey  // Random pubkey used for wrapping
    );

    const sealJson = nip44.v2.decrypt(
      giftWrapEvent.content,
      wrapConversationKey
    );

    const seal = JSON.parse(sealJson) as Event;

    // Step 3: Verify seal is kind 13
    if (seal.kind !== KIND_SEAL) {
      return null;
    }

    // Step 4: Unseal the rumor (decrypt kind 13 with actual sender's pubkey)
    const sealConversationKey = nip44.v2.utils.getConversationKey(
      recipientPrivkey,
      seal.pubkey  // Real sender's pubkey
    );

    const rumorJson = nip44.v2.decrypt(
      seal.content,
      sealConversationKey
    );

    const rumor = JSON.parse(rumorJson) as UnsignedEvent;

    // Step 5: Verify rumor is kind 14
    if (rumor.kind !== KIND_SEALED_RUMOR) {
      return null;
    }

    // Step 6: Return decrypted content with real sender info
    return {
      content: rumor.content,
      senderPubkey: rumor.pubkey,
      timestamp: rumor.created_at,
    };
  } catch (error) {
    // Decryption failed or malformed event
    console.error('Failed to decrypt DM:', error);
    return null;
  }
}

/**
 * Helper to create a subscription filter for receiving DMs
 *
 * @param recipientPubkey - Your public key
 * @returns Filter object for relay subscription
 *
 * @example
 * ```typescript
 * const myPubkey = getPublicKey(myPrivkey);
 * const filter = createDMFilter(myPubkey);
 *
 * relay.subscribe([filter], (event) => {
 *   const dm = receiveDM(event, myPrivkey);
 *   if (dm) {
 *     console.log('New DM:', dm);
 *   }
 * });
 * ```
 */
export function createDMFilter(recipientPubkey: string): { kinds: number[]; '#p': string[] } {
  return {
    kinds: [KIND_GIFT_WRAP],
    '#p': [recipientPubkey],
  };
}
