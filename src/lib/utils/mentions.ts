/**
 * Utilities for handling @mentions in messages
 * Supports parsing, formatting, and tag generation for Nostr events
 */

export interface Mention {
  pubkey: string;
  startIndex: number;
  endIndex: number;
  displayName?: string;
}

export interface UserMap {
  [pubkey: string]: {
    name?: string;
    displayName?: string;
  };
}

/**
 * Regular expression to match @mentions
 * Matches @npub... or @pubkey format
 */
const MENTION_REGEX = /@(npub1[a-z0-9]{58}|[a-f0-9]{64})/gi;

/**
 * Parse mentions from message content
 * @param content - The message content to parse
 * @returns Array of detected mentions
 */
export function parseMentions(content: string): Mention[] {
  const mentions: Mention[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const pubkey = match[1];
    mentions.push({
      pubkey,
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return mentions;
}

/**
 * Format mentions in content by replacing pubkeys with display names
 * @param content - The message content
 * @param userMap - Map of pubkey to user info
 * @returns Formatted content with display names
 */
export function formatMentions(content: string, userMap: UserMap): string {
  const mentions = parseMentions(content);

  if (mentions.length === 0) {
    return content;
  }

  // Replace mentions in reverse order to preserve indices
  let formatted = content;

  for (let i = mentions.length - 1; i >= 0; i--) {
    const mention = mentions[i];
    const userInfo = userMap[mention.pubkey];
    const displayName = userInfo?.displayName || userInfo?.name || formatPubkey(mention.pubkey);

    // Replace @pubkey with @displayName
    formatted =
      formatted.slice(0, mention.startIndex) +
      '@' + displayName +
      formatted.slice(mention.endIndex);
  }

  return formatted;
}

/**
 * Create Nostr 'p' tags for mentioned users
 * These tags are included in the event to notify mentioned users
 * @param content - The message content
 * @returns Array of p-tags for Nostr events
 */
export function createMentionTags(content: string): string[][] {
  const mentions = parseMentions(content);
  const uniquePubkeys = new Set(mentions.map(m => m.pubkey));

  // Return array of ['p', pubkey] tags
  return Array.from(uniquePubkeys).map(pubkey => ['p', pubkey]);
}

/**
 * Check if a specific user is mentioned in an event
 * @param event - The Nostr event to check
 * @param pubkey - The user's pubkey to look for
 * @returns True if the user is mentioned
 */
export function isMentioned(event: { tags?: string[][]; content: string }, pubkey: string): boolean {
  // Check if pubkey is in p-tags
  if (event.tags) {
    const hasPTag = event.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey);
    if (hasPTag) return true;
  }

  // Fallback: check content for @pubkey pattern
  const mentions = parseMentions(event.content);
  return mentions.some(m => m.pubkey === pubkey);
}

/**
 * Format pubkey for display (shortened version)
 * @param pubkey - The pubkey to format
 * @returns Shortened pubkey string
 */
export function formatPubkey(pubkey: string): string {
  if (!pubkey) return '';

  if (pubkey.startsWith('npub1')) {
    // For npub, show first 12 and last 4 characters
    return pubkey.slice(0, 12) + '...' + pubkey.slice(-4);
  }

  // For hex pubkey, show first 8 and last 4 characters
  return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
}

/**
 * Convert hex pubkey to npub format (basic conversion)
 * Note: In production, use nostr-tools for proper bech32 encoding
 * @param hexPubkey - Hex format pubkey
 * @returns npub format (or hex if conversion fails)
 */
export function hexToNpub(hexPubkey: string): string {
  // This is a placeholder - in production, use nostr-tools:
  // import { nip19 } from 'nostr-tools';
  // return nip19.npubEncode(hexPubkey);

  // For now, return hex
  return hexPubkey;
}

/**
 * Convert npub to hex pubkey (basic conversion)
 * Note: In production, use nostr-tools for proper bech32 decoding
 * @param npub - npub format pubkey
 * @returns hex format pubkey
 */
export function npubToHex(npub: string): string {
  // This is a placeholder - in production, use nostr-tools:
  // import { nip19 } from 'nostr-tools';
  // const decoded = nip19.decode(npub);
  // return decoded.data as string;

  // For now, return as-is if not npub format
  if (!npub.startsWith('npub1')) {
    return npub;
  }

  return npub;
}

/**
 * Extract all unique mentioned pubkeys from content
 * @param content - The message content
 * @returns Array of unique pubkeys
 */
export function extractMentionedPubkeys(content: string): string[] {
  const mentions = parseMentions(content);
  const uniquePubkeys = new Set(mentions.map(m => m.pubkey));
  return Array.from(uniquePubkeys);
}

/**
 * Check if content contains any mentions
 * @param content - The message content
 * @returns True if content has mentions
 */
export function hasMentions(content: string): boolean {
  return parseMentions(content).length > 0;
}
