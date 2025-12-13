/**
 * Nostr Events Helper Module
 * Provides utilities for creating, signing, parsing, and filtering Nostr events
 */

import {
  finalizeEvent,
  verifyEvent,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import type {
  NostrEvent,
  Filter,
  UserProfile,
  ChannelMessage,
} from '../../types/nostr';
import { EventKind } from '../../types/nostr';

// ============================================================================
// Event Creation Helpers
// ============================================================================

/**
 * Create a channel message event (kind 9)
 * @param content - Message content
 * @param channelId - Channel identifier (event ID of channel creation event)
 * @param privkey - Hex-encoded private key
 * @returns Signed Nostr event
 */
export function createChannelMessage(
  content: string,
  channelId: string,
  privkey: string
): NostrEvent {
  const eventTemplate: EventTemplate = {
    kind: EventKind.CHANNEL_MESSAGE,
    created_at: nowSeconds(),
    tags: [
      ['e', channelId, '', 'root'],
    ],
    content,
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Create a user metadata event (kind 0)
 * @param profile - User profile data
 * @param privkey - Hex-encoded private key
 * @returns Signed Nostr event
 */
export function createUserMetadata(
  profile: UserProfile,
  privkey: string
): NostrEvent {
  const eventTemplate: EventTemplate = {
    kind: EventKind.METADATA,
    created_at: nowSeconds(),
    tags: [],
    content: JSON.stringify(profile),
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Create a deletion event (kind 5)
 * @param eventIds - Array of event IDs to delete
 * @param privkey - Hex-encoded private key
 * @param reason - Optional reason for deletion
 * @returns Signed Nostr event
 */
export function createDeletionEvent(
  eventIds: string[],
  privkey: string,
  reason?: string
): NostrEvent {
  const eventTemplate: EventTemplate = {
    kind: EventKind.DELETION,
    created_at: nowSeconds(),
    tags: eventIds.map(id => ['e', id]),
    content: reason || '',
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Create a text note event (kind 1)
 * @param content - Note content
 * @param privkey - Hex-encoded private key
 * @param replyTo - Optional event ID to reply to
 * @returns Signed Nostr event
 */
export function createTextNote(
  content: string,
  privkey: string,
  replyTo?: string
): NostrEvent {
  const tags: string[][] = [];

  if (replyTo) {
    tags.push(['e', replyTo, '', 'reply']);
  }

  const eventTemplate: EventTemplate = {
    kind: EventKind.TEXT_NOTE,
    created_at: nowSeconds(),
    tags,
    content,
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Create a reaction event (kind 7)
 * @param eventId - Event ID to react to
 * @param authorPubkey - Pubkey of the event author
 * @param privkey - Hex-encoded private key
 * @param reaction - Reaction content (default: "+")
 * @returns Signed Nostr event
 */
export function createReaction(
  eventId: string,
  authorPubkey: string,
  privkey: string,
  reaction: string = '+'
): NostrEvent {
  const eventTemplate: EventTemplate = {
    kind: EventKind.REACTION,
    created_at: nowSeconds(),
    tags: [
      ['e', eventId],
      ['p', authorPubkey],
    ],
    content: reaction,
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

// ============================================================================
// Event Signing and Verification
// ============================================================================

/**
 * Sign an unsigned event
 * @param event - Event template to sign
 * @param privkey - Hex-encoded private key
 * @returns Signed Nostr event
 */
export function signEvent(
  event: EventTemplate,
  privkey: string
): NostrEvent {
  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(event, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Compute event hash (ID) according to NIP-01
 * @param event - Event to hash
 * @returns Hex-encoded event hash
 */
function computeEventHash(event: NostrEvent): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/**
 * Verify an event's signature
 * Always performs fresh verification (no caching) to ensure tampered events are detected.
 * @param event - Event to verify
 * @returns True if signature is valid
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  try {
    // First verify the event ID matches the content hash
    const computedId = computeEventHash(event);
    if (computedId !== event.id) {
      return false;
    }
    // Verify the schnorr signature against the event ID
    return schnorr.verify(event.sig, event.id, event.pubkey);
  } catch {
    return false;
  }
}

// ============================================================================
// Event Parsing
// ============================================================================

/**
 * Parse a channel message event
 * @param event - Nostr event to parse
 * @returns Parsed channel message or null
 */
export function parseChannelMessage(event: NostrEvent): ChannelMessage | null {
  if (event.kind !== EventKind.CHANNEL_MESSAGE) {
    return null;
  }

  const channelTag = event.tags.find(
    tag => tag[0] === 'e' && (tag[3] === 'root' || !tag[3])
  );

  if (!channelTag) {
    return null;
  }

  return {
    content: event.content,
    channelId: channelTag[1],
    author: event.pubkey,
    timestamp: event.created_at,
    eventId: event.id,
    tags: event.tags,
  };
}

/**
 * Parse a user metadata event
 * @param event - Nostr event to parse
 * @returns Parsed user profile or null
 */
export function parseUserMetadata(event: NostrEvent): UserProfile | null {
  if (event.kind !== EventKind.METADATA) {
    return null;
  }

  try {
    const profile = JSON.parse(event.content) as UserProfile;
    return profile;
  } catch {
    return null;
  }
}

/**
 * Get all tags of a specific name from an event
 * @param event - Nostr event
 * @param tagName - Tag name to filter by (e.g., 'e', 'p')
 * @returns Array of tag values
 */
export function getEventTags(event: NostrEvent, tagName: string): string[] {
  return event.tags
    .filter(tag => tag[0] === tagName)
    .map(tag => tag[1])
    .filter(Boolean);
}

/**
 * Get the first tag value of a specific name
 * @param event - Nostr event
 * @param tagName - Tag name to get
 * @returns Tag value or undefined
 */
export function getEventTag(event: NostrEvent, tagName: string): string | undefined {
  const tag = event.tags.find(tag => tag[0] === tagName);
  return tag?.[1];
}

/**
 * Check if an event references another event
 * @param event - Event to check
 * @param targetEventId - Event ID to look for
 * @returns True if event references the target
 */
export function eventReferences(event: NostrEvent, targetEventId: string): boolean {
  return getEventTags(event, 'e').includes(targetEventId);
}

/**
 * Check if an event mentions a pubkey
 * @param event - Event to check
 * @param targetPubkey - Pubkey to look for
 * @returns True if event mentions the target
 */
export function eventMentions(event: NostrEvent, targetPubkey: string): boolean {
  return getEventTags(event, 'p').includes(targetPubkey);
}

// ============================================================================
// NIP-19 Encoding/Decoding
// ============================================================================

/**
 * Encode hex pubkey to npub format (NIP-19)
 * @param hexPubkey - Hex-encoded public key
 * @returns npub-encoded string
 */
export function npubEncode(hexPubkey: string): string {
  return nip19.npubEncode(hexPubkey) as string;
}

/**
 * Decode npub to hex pubkey
 * @param npub - npub-encoded string
 * @returns Hex-encoded public key
 * @throws Error if decoding fails
 */
export function npubDecode(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error(`Invalid npub format: expected npub, got ${decoded.type}`);
  }
  return decoded.data as string;
}

/**
 * Encode event ID to note format (NIP-19)
 * @param eventId - Hex-encoded event ID
 * @returns note-encoded string
 */
export function noteEncode(eventId: string): string {
  return nip19.noteEncode(eventId) as string;
}

/**
 * Decode note to event ID
 * @param note - note-encoded string
 * @returns Hex-encoded event ID
 * @throws Error if decoding fails
 */
export function noteDecode(note: string): string {
  const decoded = nip19.decode(note);
  if (decoded.type !== 'note') {
    throw new Error(`Invalid note format: expected note, got ${decoded.type}`);
  }
  return decoded.data as string;
}

/**
 * Encode private key to nsec format (NIP-19)
 * @param hexPrivkey - Hex-encoded private key
 * @returns nsec-encoded string
 */
export function nsecEncode(hexPrivkey: string): string {
  const privkeyBytes = hexToBytes(hexPrivkey);
  return nip19.nsecEncode(privkeyBytes) as string;
}

/**
 * Decode nsec to hex private key
 * @param nsec - nsec-encoded string
 * @returns Hex-encoded private key
 * @throws Error if decoding fails
 */
export function nsecDecode(nsec: string): string {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error(`Invalid nsec format: expected nsec, got ${decoded.type}`);
  }
  return bytesToHex(decoded.data);
}

/**
 * Encode event as nevent (NIP-19)
 * @param eventId - Event ID
 * @param relays - Optional relay hints
 * @param author - Optional author pubkey
 * @returns nevent-encoded string
 */
export function neventEncode(
  eventId: string,
  relays?: string[],
  author?: string
): string {
  return nip19.neventEncode({ id: eventId, relays, author }) as string;
}

/**
 * Encode profile as nprofile (NIP-19)
 * @param pubkey - Public key
 * @param relays - Optional relay hints
 * @returns nprofile-encoded string
 */
export function nprofileEncode(pubkey: string, relays?: string[]): string {
  return nip19.nprofileEncode({ pubkey, relays }) as string;
}

// ============================================================================
// Event Filters
// ============================================================================

/**
 * Create a filter for channel messages
 * @param channelId - Channel ID (event ID of channel creation)
 * @param since - Optional timestamp to filter from
 * @param limit - Maximum number of events
 * @returns Nostr filter
 */
export function channelMessagesFilter(
  channelId: string,
  since?: number,
  limit: number = 100
): Filter {
  return {
    kinds: [EventKind.CHANNEL_MESSAGE],
    '#e': [channelId],
    since,
    limit,
  };
}

/**
 * Create a filter for user metadata
 * @param pubkeys - Array of public keys
 * @returns Nostr filter
 */
export function userMetadataFilter(pubkeys: string[]): Filter {
  return {
    kinds: [EventKind.METADATA],
    authors: pubkeys,
  };
}

/**
 * Create a filter for direct messages
 * @param userPubkey - User's public key
 * @param since - Optional timestamp to filter from
 * @param limit - Maximum number of events
 * @returns Nostr filter
 */
export function dmFilter(
  userPubkey: string,
  since?: number,
  limit: number = 50
): Filter {
  return {
    kinds: [EventKind.ENCRYPTED_DM],
    '#p': [userPubkey],
    since,
    limit,
  };
}

/**
 * Create a filter for text notes from specific authors
 * @param authors - Array of author pubkeys
 * @param since - Optional timestamp to filter from
 * @param limit - Maximum number of events
 * @returns Nostr filter
 */
export function textNotesFilter(
  authors: string[],
  since?: number,
  limit: number = 100
): Filter {
  return {
    kinds: [EventKind.TEXT_NOTE],
    authors,
    since,
    limit,
  };
}

/**
 * Create a filter for reactions to a specific event
 * @param eventId - Event ID
 * @param limit - Maximum number of events
 * @returns Nostr filter
 */
export function reactionsFilter(eventId: string, limit: number = 100): Filter {
  return {
    kinds: [EventKind.REACTION],
    '#e': [eventId],
    limit,
  };
}

/**
 * Create a filter for events by specific IDs
 * @param eventIds - Array of event IDs
 * @returns Nostr filter
 */
export function eventsByIdFilter(eventIds: string[]): Filter {
  return {
    ids: eventIds,
  };
}

/**
 * Create a filter for replies to a specific event
 * @param eventId - Event ID
 * @param limit - Maximum number of events
 * @returns Nostr filter
 */
export function repliesFilter(eventId: string, limit: number = 100): Filter {
  return {
    kinds: [EventKind.TEXT_NOTE],
    '#e': [eventId],
    limit,
  };
}

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Get current Unix timestamp in seconds
 * @returns Current timestamp
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format timestamp as relative time
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = nowSeconds();
  const diff = now - timestamp;

  if (diff < 0) {
    return 'in the future';
  }

  if (diff < 60) {
    return 'just now';
  }

  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  }

  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  if (diff < 2592000) {
    const weeks = Math.floor(diff / 604800);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }

  if (diff < 31536000) {
    const months = Math.floor(diff / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(diff / 31536000);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Format timestamp as absolute time
 * @param timestamp - Unix timestamp in seconds
 * @param includeTime - Whether to include time
 * @returns Formatted date string
 */
export function formatAbsoluteTime(
  timestamp: number,
  includeTime: boolean = true
): string {
  const date = new Date(timestamp * 1000);

  if (includeTime) {
    return date.toLocaleString();
  }

  return date.toLocaleDateString();
}

/**
 * Check if timestamp is recent (within last N seconds)
 * @param timestamp - Unix timestamp in seconds
 * @param seconds - Number of seconds to check
 * @returns True if timestamp is within the last N seconds
 */
export function isRecent(timestamp: number, seconds: number): boolean {
  return nowSeconds() - timestamp < seconds;
}

/**
 * Convert milliseconds timestamp to seconds
 * @param ms - Timestamp in milliseconds
 * @returns Timestamp in seconds
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Convert seconds timestamp to milliseconds
 * @param seconds - Timestamp in seconds
 * @returns Timestamp in milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

// ============================================================================
// Event Validation
// ============================================================================

/**
 * Validate event structure
 * @param event - Event to validate
 * @returns True if event structure is valid
 */
export function isValidEventStructure(event: unknown): event is NostrEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const e = event as Partial<NostrEvent>;

  return (
    typeof e.id === 'string' &&
    typeof e.pubkey === 'string' &&
    typeof e.created_at === 'number' &&
    typeof e.kind === 'number' &&
    Array.isArray(e.tags) &&
    typeof e.content === 'string' &&
    typeof e.sig === 'string'
  );
}

/**
 * Validate and verify event
 * @param event - Event to validate
 * @returns True if event is valid and signature verifies
 */
export function isValidEvent(event: unknown): boolean {
  if (!isValidEventStructure(event)) {
    return false;
  }

  return verifyEventSignature(event);
}

/**
 * Check if event is a reply to another event
 * @param event - Event to check
 * @returns True if event is a reply
 */
export function isReply(event: NostrEvent): boolean {
  return event.tags.some(tag => tag[0] === 'e' && tag[3] === 'reply');
}

/**
 * Check if event is a root post
 * @param event - Event to check
 * @returns True if event is a root post (no reply tags)
 */
export function isRootPost(event: NostrEvent): boolean {
  return !isReply(event);
}

/**
 * Get the root event ID from a reply chain
 * @param event - Event to analyze
 * @returns Root event ID or undefined
 */
export function getRootEventId(event: NostrEvent): string | undefined {
  const rootTag = event.tags.find(tag => tag[0] === 'e' && tag[3] === 'root');
  return rootTag?.[1];
}

/**
 * Get the direct reply target event ID
 * @param event - Event to analyze
 * @returns Reply target event ID or undefined
 */
export function getReplyTargetId(event: NostrEvent): string | undefined {
  const replyTag = event.tags.find(tag => tag[0] === 'e' && tag[3] === 'reply');
  return replyTag?.[1];
}
