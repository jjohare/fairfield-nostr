/**
 * Type definitions for Nostr relay operations
 */

import type { NDKEvent, NDKFilter, NDKSubscription, NDKUser } from '@nostr-dev-kit/ndk';

/**
 * Connection state enum
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  AuthRequired = 'auth-required',
  Authenticating = 'authenticating',
  Authenticated = 'authenticated',
  AuthFailed = 'auth-failed',
  Error = 'error'
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  state: ConnectionState;
  relay?: string;
  error?: string;
  timestamp: number;
  authenticated: boolean;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  closeOnEose?: boolean;
  groupable?: boolean;
  subId?: string;
}

/**
 * Event publish result
 */
export interface PublishResult {
  success: boolean;
  relays: string[];
  error?: string;
}

/**
 * Relay stats
 */
export interface RelayStats {
  url: string;
  connected: boolean;
  authenticated: boolean;
  activeSubscriptions: number;
  eventsPublished: number;
  eventsReceived: number;
}

/**
 * Re-export NDK types
 */
export type { NDKEvent, NDKFilter, NDKSubscription, NDKUser };
