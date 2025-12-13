/**
 * NIP-25 Reactions Module
 * Provides utilities for creating, parsing, and managing reactions to Nostr events
 */

import {
  finalizeEvent,
  type EventTemplate,
} from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';
import type { NostrEvent } from '../../types/nostr';
import { EventKind } from '../../types/nostr';

/**
 * Common reaction types
 */
export const CommonReactions = {
  LIKE: '+',
  DISLIKE: '-',
  LOVE: '❤️',
  LAUGH: '😂',
  SURPRISED: '😮',
  SAD: '😢',
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  FIRE: '🔥',
  PARTY: '🎉',
} as const;

export type CommonReactionType = typeof CommonReactions[keyof typeof CommonReactions];

/**
 * Reaction data extracted from an event
 */
export interface ReactionData {
  eventId: string;
  authorPubkey: string;
  content: string;
  reactorPubkey: string;
  timestamp: number;
  reactionEventId: string;
}

/**
 * Create a reaction event (kind 7) following NIP-25
 * @param messageId - Event ID to react to
 * @param content - Reaction content (emoji or +/-)
 * @param privkey - Hex-encoded private key
 * @param authorPubkey - Optional pubkey of the event author (recommended for better relay filtering)
 * @returns Signed Nostr reaction event
 */
export function createReactionEvent(
  messageId: string,
  content: string,
  privkey: string,
  authorPubkey?: string
): NostrEvent {
  const tags: string[][] = [
    ['e', messageId],
  ];

  // Add 'p' tag if author pubkey is provided (NIP-25 recommendation)
  if (authorPubkey) {
    tags.push(['p', authorPubkey]);
  }

  const eventTemplate: EventTemplate = {
    kind: EventKind.REACTION,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  const privkeyBytes = hexToBytes(privkey);
  const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * Parse a reaction event into structured data
 * @param event - Nostr event to parse
 * @returns Parsed reaction data or null if invalid
 */
export function parseReactionEvent(event: NostrEvent): ReactionData | null {
  if (event.kind !== EventKind.REACTION) {
    return null;
  }

  // Find the 'e' tag (event being reacted to)
  const eventTag = event.tags.find(tag => tag[0] === 'e');
  if (!eventTag || !eventTag[1]) {
    return null;
  }

  // Find the 'p' tag (author of event being reacted to)
  const authorTag = event.tags.find(tag => tag[0] === 'p');

  return {
    eventId: eventTag[1],
    authorPubkey: authorTag?.[1] || '',
    content: event.content,
    reactorPubkey: event.pubkey,
    timestamp: event.created_at,
    reactionEventId: event.id,
  };
}

/**
 * Validate reaction content
 * @param content - Reaction content to validate
 * @returns True if valid reaction content
 */
export function isValidReactionContent(content: string): boolean {
  if (!content || content.length === 0) {
    return false;
  }

  // NIP-25 allows any content, but we validate it's reasonable
  // Max length check to prevent abuse
  if (content.length > 100) {
    return false;
  }

  return true;
}

/**
 * Normalize reaction content
 * NIP-25 treats '+' as a like, '-' as dislike, and emojis as-is
 * @param content - Raw reaction content
 * @returns Normalized reaction content
 */
export function normalizeReactionContent(content: string): string {
  const trimmed = content.trim();

  // Normalize common reactions
  if (trimmed === '+' || trimmed === '👍' || trimmed.toLowerCase() === 'like') {
    return CommonReactions.LIKE;
  }

  if (trimmed === '-' || trimmed === '👎' || trimmed.toLowerCase() === 'dislike') {
    return CommonReactions.DISLIKE;
  }

  return trimmed;
}

/**
 * Check if reaction is a "like" (positive reaction)
 * @param content - Reaction content
 * @returns True if it's a like/positive reaction
 */
export function isLikeReaction(content: string): boolean {
  const normalized = normalizeReactionContent(content);
  return normalized === CommonReactions.LIKE;
}

/**
 * Check if reaction is a "dislike" (negative reaction)
 * @param content - Reaction content
 * @returns True if it's a dislike/negative reaction
 */
export function isDislikeReaction(content: string): boolean {
  const normalized = normalizeReactionContent(content);
  return normalized === CommonReactions.DISLIKE;
}

/**
 * Get display emoji for reaction content
 * Converts text reactions to emojis where appropriate
 * @param content - Reaction content
 * @returns Display-friendly emoji
 */
export function getReactionEmoji(content: string): string {
  const normalized = normalizeReactionContent(content);

  // Map common text to emojis
  const emojiMap: Record<string, string> = {
    [CommonReactions.LIKE]: '👍',
    [CommonReactions.DISLIKE]: '👎',
  };

  return emojiMap[normalized] || normalized;
}

/**
 * Group reactions by content
 * @param reactions - Array of reaction data
 * @returns Map of reaction content to array of reactor pubkeys
 */
export function groupReactionsByContent(
  reactions: ReactionData[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const reaction of reactions) {
    const normalized = normalizeReactionContent(reaction.content);
    const existing = grouped.get(normalized) || [];

    // Avoid duplicate reactions from same user
    if (!existing.includes(reaction.reactorPubkey)) {
      existing.push(reaction.reactorPubkey);
      grouped.set(normalized, existing);
    }
  }

  return grouped;
}

/**
 * Count reactions by type
 * @param reactions - Array of reaction data
 * @returns Map of reaction content to count
 */
export function countReactions(reactions: ReactionData[]): Map<string, number> {
  const grouped = groupReactionsByContent(reactions);
  const counts = new Map<string, number>();

  for (const [content, reactors] of grouped.entries()) {
    counts.set(content, reactors.length);
  }

  return counts;
}

/**
 * Check if a user has reacted to an event
 * @param reactions - Array of reaction data
 * @param userPubkey - User's public key
 * @param reactionContent - Optional specific reaction to check for
 * @returns True if user has reacted
 */
export function hasUserReacted(
  reactions: ReactionData[],
  userPubkey: string,
  reactionContent?: string
): boolean {
  return reactions.some(reaction => {
    if (reaction.reactorPubkey !== userPubkey) {
      return false;
    }

    if (reactionContent) {
      const normalized = normalizeReactionContent(reaction.content);
      const targetNormalized = normalizeReactionContent(reactionContent);
      return normalized === targetNormalized;
    }

    return true;
  });
}

/**
 * Get user's reaction to an event
 * @param reactions - Array of reaction data
 * @param userPubkey - User's public key
 * @returns User's reaction data or null
 */
export function getUserReaction(
  reactions: ReactionData[],
  userPubkey: string
): ReactionData | null {
  return reactions.find(r => r.reactorPubkey === userPubkey) || null;
}

/**
 * Filter reactions for a specific event
 * @param reactions - Array of all reactions
 * @param eventId - Event ID to filter by
 * @returns Reactions for the specified event
 */
export function getReactionsForEvent(
  reactions: ReactionData[],
  eventId: string
): ReactionData[] {
  return reactions.filter(r => r.eventId === eventId);
}

/**
 * Get most popular reactions
 * @param reactions - Array of reaction data
 * @param limit - Maximum number of reactions to return
 * @returns Array of [content, count] tuples sorted by popularity
 */
export function getPopularReactions(
  reactions: ReactionData[],
  limit: number = 5
): Array<[string, number]> {
  const counts = countReactions(reactions);

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
