/**
 * Nostr Type Definitions
 * Based on NIP-01 and related NIPs
 */

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface UnsignedEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [key: `#${string}`]: string[] | undefined;
}

export interface UserProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
}

export interface ChannelMessage {
  content: string;
  channelId: string;
  author: string;
  timestamp: number;
  eventId: string;
  tags: string[][];
}

export interface RelayEvent {
  type: 'EVENT' | 'NOTICE' | 'EOSE' | 'OK' | 'AUTH' | 'CLOSED';
  data: unknown;
}

export const EventKind = {
  METADATA: 0,
  TEXT_NOTE: 1,
  RECOMMEND_RELAY: 2,
  CONTACTS: 3,
  ENCRYPTED_DM: 4,
  DELETION: 5,
  REPOST: 6,
  REACTION: 7,
  BADGE_AWARD: 8,
  CHANNEL_MESSAGE: 9,
  CHANNEL_CREATE: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTE_USER: 44,
  ZAP_REQUEST: 9734,
  ZAP_RECEIPT: 9735,
  LONG_FORM: 30023,
  APP_SPECIFIC: 30078,
} as const;

export type EventKindType = typeof EventKind[keyof typeof EventKind];
