/**
 * NIP-44 E2E Encryption Module for Fairfield Nostr
 *
 * Implements end-to-end encryption for private group channels using NIP-44 v2.
 * Messages are encrypted individually for each channel member using ECDH shared secrets.
 *
 * @module encryption
 */

import { type Event, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { nip44 } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';

/**
 * Encrypted message payload structure
 */
interface EncryptedPayloads {
  [recipientPubkey: string]: string;
}

/**
 * Decrypted message result
 */
interface DecryptedMessage {
  content: string;
  senderPubkey: string;
  timestamp: number;
  channelId: string;
}

/**
 * Encryption error types
 */
export class EncryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Validates a hexadecimal key
 * @param key - Hex string to validate
 * @param type - Key type for error messaging
 * @throws {EncryptionError} If key is invalid
 */
function validateHexKey(key: string, type: string): void {
  if (!key || typeof key !== 'string') {
    throw new EncryptionError(`${type} is required and must be a string`, 'INVALID_KEY');
  }

  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new EncryptionError(
      `${type} must be a 64-character hexadecimal string`,
      'INVALID_KEY_FORMAT'
    );
  }
}

/**
 * Validates an array of public keys
 * @param pubkeys - Array of public keys to validate
 * @throws {EncryptionError} If any key is invalid
 */
function validatePubkeys(pubkeys: string[]): void {
  if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
    throw new EncryptionError(
      'Member public keys array is required and must not be empty',
      'INVALID_MEMBERS'
    );
  }

  for (const pubkey of pubkeys) {
    validateHexKey(pubkey, 'Member public key');
  }
}

/**
 * Encrypts a message for an E2E encrypted channel using NIP-44 v2
 *
 * Creates a Nostr event (kind 9) containing individually encrypted payloads
 * for each channel member. Each member can decrypt only their own payload
 * using their private key and the sender's public key.
 *
 * @param content - Plaintext message content
 * @param channelId - Channel identifier (h tag value)
 * @param senderPrivkey - Sender's private key (64-char hex)
 * @param memberPubkeys - Array of member public keys (64-char hex each)
 * @returns Signed Nostr event with encrypted payloads
 * @throws {EncryptionError} If encryption fails or keys are invalid
 *
 * @example
 * ```typescript
 * const event = await encryptChannelMessage(
 *   "Hello everyone!",
 *   "channel123",
 *   senderPrivateKey,
 *   [member1Pubkey, member2Pubkey, member3Pubkey]
 * );
 * await relay.publish(event);
 * ```
 */
export async function encryptChannelMessage(
  content: string,
  channelId: string,
  senderPrivkey: string,
  memberPubkeys: string[]
): Promise<Event> {
  // Input validation
  if (!content || typeof content !== 'string') {
    throw new EncryptionError('Message content is required', 'INVALID_CONTENT');
  }

  if (!channelId || typeof channelId !== 'string') {
    throw new EncryptionError('Channel ID is required', 'INVALID_CHANNEL');
  }

  validateHexKey(senderPrivkey, 'Sender private key');
  validatePubkeys(memberPubkeys);

  // Get sender's public key
  let senderPubkey: string;
  try {
    senderPubkey = getPublicKey(hexToBytes(senderPrivkey));
  } catch (error) {
    throw new EncryptionError(
      `Failed to derive public key from private key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'KEY_DERIVATION_FAILED'
    );
  }

  // Encrypt payload for each member
  const encryptedPayloads: EncryptedPayloads = {};
  const errors: Array<{ pubkey: string; error: string }> = [];

  for (const memberPubkey of memberPubkeys) {
    try {
      // Generate conversation key using NIP-44
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(senderPrivkey),
        hexToBytes(memberPubkey)
      );

      // Encrypt content for this member
      const encrypted = nip44.v2.encrypt(content, conversationKey);
      encryptedPayloads[memberPubkey] = encrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown encryption error';
      errors.push({ pubkey: memberPubkey, error: errorMessage });
    }
  }

  // If any encryption failed, throw error with details
  if (errors.length > 0) {
    throw new EncryptionError(
      `Failed to encrypt for ${errors.length} member(s): ${JSON.stringify(errors)}`,
      'ENCRYPTION_FAILED'
    );
  }

  // Build event tags
  const tags: string[][] = [
    ['h', channelId],
    ['encrypted', 'nip44'],
    // Add recipient hints for efficient client-side filtering
    ...memberPubkeys.map(pk => ['p', pk])
  ];

  // Create unsigned event
  const unsignedEvent = {
    kind: 9,
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify(encryptedPayloads),
  };

  // Sign and return
  try {
    return finalizeEvent(unsignedEvent, hexToBytes(senderPrivkey));
  } catch (error) {
    throw new EncryptionError(
      `Failed to sign event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SIGNING_FAILED'
    );
  }
}

/**
 * Decrypts a channel message event using the recipient's private key
 *
 * Extracts and decrypts the payload intended for the recipient from an
 * encrypted channel message event. Returns null if decryption fails or
 * if no payload exists for this recipient.
 *
 * @param event - Encrypted Nostr event (kind 9 with 'encrypted' tag)
 * @param recipientPrivkey - Recipient's private key (64-char hex)
 * @returns Decrypted message object or null if decryption fails
 * @throws {EncryptionError} If event structure is invalid
 *
 * @example
 * ```typescript
 * const decrypted = decryptChannelMessage(encryptedEvent, myPrivateKey);
 * if (decrypted) {
 *   console.log(`Message from ${decrypted.senderPubkey}: ${decrypted.content}`);
 * } else {
 *   console.log('Could not decrypt message (not a recipient or corrupted)');
 * }
 * ```
 */
export function decryptChannelMessage(
  event: Event,
  recipientPrivkey: string
): DecryptedMessage | null {
  // Input validation
  if (!event || typeof event !== 'object') {
    throw new EncryptionError('Event is required and must be an object', 'INVALID_EVENT');
  }

  if (event.kind !== 9) {
    throw new EncryptionError(
      `Invalid event kind: expected 9, got ${event.kind}`,
      'INVALID_EVENT_KIND'
    );
  }

  validateHexKey(recipientPrivkey, 'Recipient private key');

  // Verify event has encrypted tag
  const hasEncryptedTag = event.tags.some(
    tag => tag[0] === 'encrypted' && tag[1] === 'nip44'
  );

  if (!hasEncryptedTag) {
    throw new EncryptionError(
      'Event is not marked as NIP-44 encrypted',
      'NOT_ENCRYPTED_EVENT'
    );
  }

  // Extract channel ID
  const channelTag = event.tags.find(tag => tag[0] === 'h');
  if (!channelTag || !channelTag[1]) {
    throw new EncryptionError('Event missing channel ID (h tag)', 'MISSING_CHANNEL_ID');
  }
  const channelId = channelTag[1];

  // Get recipient's public key
  let recipientPubkey: string;
  try {
    recipientPubkey = getPublicKey(hexToBytes(recipientPrivkey));
  } catch (error) {
    throw new EncryptionError(
      `Failed to derive public key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'KEY_DERIVATION_FAILED'
    );
  }

  // Parse encrypted payloads
  let payloads: EncryptedPayloads;
  try {
    payloads = JSON.parse(event.content);
  } catch (error) {
    throw new EncryptionError(
      'Failed to parse event content as JSON',
      'INVALID_CONTENT_FORMAT'
    );
  }

  // Check if we have a payload for this recipient
  const myPayload = payloads[recipientPubkey];
  if (!myPayload) {
    // Not an error - this recipient is not in the encrypted payload map
    return null;
  }

  // Decrypt our payload
  try {
    const conversationKey = nip44.v2.utils.getConversationKey(
      hexToBytes(recipientPrivkey),
      hexToBytes(event.pubkey)
    );

    const decryptedContent = nip44.v2.decrypt(myPayload, conversationKey);

    return {
      content: decryptedContent,
      senderPubkey: event.pubkey,
      timestamp: event.created_at,
      channelId,
    };
  } catch (error) {
    // Decryption failed - could be corrupted data or wrong key
    // Return null instead of throwing to allow graceful handling
    return null;
  }
}

/**
 * Checks if an event is an encrypted channel message
 *
 * @param event - Nostr event to check
 * @returns True if event is encrypted (kind 9 with 'encrypted' tag)
 */
export function isEncryptedChannelMessage(event: Event): boolean {
  return (
    event.kind === 9 &&
    event.tags.some(tag => tag[0] === 'encrypted' && tag[1] === 'nip44')
  );
}

/**
 * Extracts the list of recipient public keys from an encrypted event
 *
 * @param event - Encrypted channel message event
 * @returns Array of recipient public keys
 */
export function getRecipients(event: Event): string[] {
  if (!isEncryptedChannelMessage(event)) {
    return [];
  }

  return event.tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Validates that a user is an intended recipient of an encrypted message
 *
 * @param event - Encrypted channel message event
 * @param userPubkey - User's public key to check
 * @returns True if user is listed as a recipient
 */
export function isRecipient(event: Event, userPubkey: string): boolean {
  const recipients = getRecipients(event);
  return recipients.includes(userPubkey);
}

export default {
  encryptChannelMessage,
  decryptChannelMessage,
  isEncryptedChannelMessage,
  getRecipients,
  isRecipient,
  EncryptionError,
};
