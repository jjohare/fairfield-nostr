/**
 * Nostr event types and interfaces
 * Simplified subset of nostr-tools types for this application
 */

export interface Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

export interface Sub {
  id: string;
  filters: Filter[];
  cb: (event: Event) => void;
}

/**
 * Relay message types
 */
export type RelayMessage =
  | ['EVENT', string, Event]
  | ['OK', string, boolean, string]
  | ['EOSE', string]
  | ['NOTICE', string]
  | ['CLOSED', string, string];

/**
 * Subscription request
 */
export type SubscriptionRequest = ['REQ', string, ...Filter[]];

/**
 * Event publish request
 */
export type EventRequest = ['EVENT', Event];

/**
 * Close subscription request
 */
export type CloseRequest = ['CLOSE', string];
