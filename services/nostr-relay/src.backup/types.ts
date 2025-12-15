/**
 * Type definitions for Nostr relay
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

export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  [key: `#${string}`]: string[] | undefined;
}

export interface RelayInfo {
  name: string;
  description: string;
  pubkey: string;
  contact: string;
  supported_nips: number[];
  software: string;
  version: string;
  icon?: string;
  limitation?: {
    payment_required?: boolean;
    restricted_writes?: boolean;
    auth_required?: boolean;
    created_at_lower_limit?: number;
    created_at_upper_limit?: number;
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
    restricted_writes?: boolean;
  };
}

export interface ClientSession {
  id: string;
  ws: WebSocket;
  subscriptions: Map<string, NostrFilter[]>;
  authenticatedPubkeys: Set<string>;
  challenge?: string;
  connectedAt: number;
  lastActivity: number;
  rateLimits: {
    events: RateLimitState;
    reqs: RateLimitState;
  };
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitConfig {
  rate: number;
  capacity: number;
}

export interface CohortAccess {
  cohortId: string;
  name: string;
  description?: string;
  allowedPubkeys: string[];
  allowedKinds: number[];
  createdAt: number;
  expiresAt?: number;
}

export interface StoredEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string;
  content: string;
  sig: string;
  indexed_at: number;
  deleted: boolean;
}

export type NostrMessage =
  | ["EVENT", NostrEvent]
  | ["REQ", string, ...NostrFilter[]]
  | ["CLOSE", string]
  | ["AUTH", NostrEvent]
  | ["OK", string, boolean, string]
  | ["EOSE", string]
  | ["CLOSED", string, string]
  | ["NOTICE", string]
  | ["AUTH", string];

export interface DatabaseConfig {
  connectionString: string;
  poolMin: number;
  poolMax: number;
}

export interface RelayConfig {
  port: number;
  host: string;
  database: DatabaseConfig;
  relayInfo: RelayInfo;
  authRequired: boolean;
  nip05ValidationEnabled: boolean;
  cohortAccessEnabled: boolean;
  rateLimits: {
    events: RateLimitConfig;
    reqs: RateLimitConfig;
  };
  eventLimits: {
    maxSize: number;
    maxSubscriptions: number;
    maxFilters: number;
    maxLimit: number;
  };
  timeLimits: {
    createdAtLower: number;
    createdAtUpper: number;
  };
  features: {
    search: boolean;
    deletion: boolean;
    ephemeral: boolean;
  };
  logging: {
    level: string;
    file?: string;
  };
}
