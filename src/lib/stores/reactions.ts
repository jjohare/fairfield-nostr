/**
 * Reactions Store
 * Manages reaction state and real-time updates for messages
 */

import { writable, derived, get } from 'svelte/store';
import { authStore } from './auth';
import type { NostrEvent, Filter } from '../../types/nostr';
import { EventKind } from '../../types/nostr';
import {
  createReactionEvent,
  parseReactionEvent,
  groupReactionsByContent,
  hasUserReacted,
  getUserReaction,
  getReactionsForEvent,
  normalizeReactionContent,
  type ReactionData,
} from '$lib/nostr/reactions';

/**
 * Reaction summary for a message
 */
export interface ReactionSummary {
  messageId: string;
  reactions: Map<string, ReactionInfo>;
  totalCount: number;
  userReaction: string | null;
}

/**
 * Information about a specific reaction type
 */
export interface ReactionInfo {
  content: string;
  count: number;
  reactors: string[];
  userReacted: boolean;
}

/**
 * Reaction store state
 */
interface ReactionState {
  // Map of messageId -> array of reactions
  reactionsByMessage: Map<string, ReactionData[]>;
  // Optimistic reactions (pending confirmation)
  optimisticReactions: Map<string, ReactionData>;
  // Loading state
  loading: boolean;
  error: string | null;
  // Subscription tracking
  activeSubscriptions: Map<string, string[]>;
}

/**
 * Relay connection for reactions
 */
interface RelayConnection {
  url: string;
  ws: WebSocket | null;
}

const initialState: ReactionState = {
  reactionsByMessage: new Map(),
  optimisticReactions: new Map(),
  loading: false,
  error: null,
  activeSubscriptions: new Map(),
};

/**
 * Create the reaction store
 */
function createReactionStore() {
  const { subscribe, set, update } = writable<ReactionState>(initialState);

  // Relay connections
  const relayConnections = new Map<string, RelayConnection>();

  /**
   * Connect to relay
   */
  async function connectToRelay(relayUrl: string): Promise<WebSocket> {
    const existing = relayConnections.get(relayUrl);
    if (existing?.ws?.readyState === WebSocket.OPEN) {
      return existing.ws;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(relayUrl);

      ws.onopen = () => {
        relayConnections.set(relayUrl, { url: relayUrl, ws });
        resolve(ws);
      };

      ws.onerror = reject;

      ws.onclose = () => {
        relayConnections.delete(relayUrl);
      };
    });
  }

  /**
   * Subscribe to relay events
   */
  async function subscribeToRelay(
    relayUrl: string,
    filters: Filter[],
    onEvent: (event: NostrEvent) => void
  ): Promise<string> {
    const ws = await connectToRelay(relayUrl);
    const subId = Math.random().toString(36).substring(7);

    ws.send(JSON.stringify(['REQ', subId, ...filters]));

    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data[0] === 'EVENT' && data[1] === subId) {
          onEvent(data[2]);
        }
      } catch (error) {
        console.error('Failed to parse relay message:', error);
      }
    };

    ws.addEventListener('message', messageHandler);

    return subId;
  }

  /**
   * Unsubscribe from relay
   */
  function unsubscribeFromRelay(relayUrl: string, subId: string): void {
    const connection = relayConnections.get(relayUrl);
    if (connection?.ws?.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(['CLOSE', subId]));
    }
  }

  /**
   * Publish event to relay
   */
  async function publishToRelay(relayUrl: string, event: NostrEvent): Promise<void> {
    const ws = await connectToRelay(relayUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Publish timeout'));
      }, 10000);

      const messageHandler = (msgEvent: MessageEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);
          if (data[0] === 'OK' && data[1] === event.id) {
            clearTimeout(timeout);
            ws.removeEventListener('message', messageHandler);

            if (data[2] === true) {
              resolve();
            } else {
              reject(new Error(data[3] || 'Event rejected'));
            }
          }
        } catch (error) {
          console.error('Failed to parse relay response:', error);
        }
      };

      ws.addEventListener('message', messageHandler);
      ws.send(JSON.stringify(['EVENT', event]));
    });
  }

  return {
    subscribe,

    /**
     * Fetch reactions for multiple messages
     */
    async fetchReactions(
      messageIds: string[],
      relayUrl: string
    ): Promise<void> {
      if (messageIds.length === 0) return;

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const filter: Filter = {
          kinds: [EventKind.REACTION],
          '#e': messageIds,
        };

        await subscribeToRelay(relayUrl, [filter], (event) => {
          const reactionData = parseReactionEvent(event);
          if (!reactionData) return;

          update(state => {
            const existing = state.reactionsByMessage.get(reactionData.eventId) || [];

            // Check for duplicate
            const isDuplicate = existing.some(
              r => r.reactionEventId === reactionData.reactionEventId
            );

            if (!isDuplicate) {
              const updated = [...existing, reactionData];
              state.reactionsByMessage.set(reactionData.eventId, updated);
            }

            return { ...state, loading: false };
          });
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch reactions';
        update(state => ({ ...state, error: errorMsg, loading: false }));
      }
    },

    /**
     * Add a reaction to a message
     */
    async addReaction(
      messageId: string,
      emoji: string,
      relayUrl: string,
      authorPubkey?: string
    ): Promise<void> {
      const auth = get(authStore);
      if (!auth.privateKey) {
        throw new Error('No private key available');
      }

      const normalized = normalizeReactionContent(emoji);

      // Create optimistic reaction
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticReaction: ReactionData = {
        eventId: messageId,
        authorPubkey: authorPubkey || '',
        content: normalized,
        reactorPubkey: auth.publicKey || '',
        timestamp: Math.floor(Date.now() / 1000),
        reactionEventId: optimisticId,
      };

      // Add optimistically
      update(state => {
        const existing = state.reactionsByMessage.get(messageId) || [];

        // Remove any existing reaction from this user
        const filtered = existing.filter(
          r => r.reactorPubkey !== optimisticReaction.reactorPubkey
        );

        state.reactionsByMessage.set(messageId, [...filtered, optimisticReaction]);
        state.optimisticReactions.set(optimisticId, optimisticReaction);

        return { ...state };
      });

      try {
        // Create and publish reaction event
        const event = createReactionEvent(
          messageId,
          normalized,
          auth.privateKey,
          authorPubkey
        );

        await publishToRelay(relayUrl, event);

        // Replace optimistic with real reaction
        const realReaction: ReactionData = {
          ...optimisticReaction,
          reactionEventId: event.id,
        };

        update(state => {
          const existing = state.reactionsByMessage.get(messageId) || [];
          const withoutOptimistic = existing.filter(
            r => r.reactionEventId !== optimisticId
          );

          state.reactionsByMessage.set(messageId, [...withoutOptimistic, realReaction]);
          state.optimisticReactions.delete(optimisticId);

          return { ...state };
        });

      } catch (error) {
        // Remove optimistic reaction on failure
        update(state => {
          const existing = state.reactionsByMessage.get(messageId) || [];
          const filtered = existing.filter(r => r.reactionEventId !== optimisticId);

          state.reactionsByMessage.set(messageId, filtered);
          state.optimisticReactions.delete(optimisticId);

          return {
            ...state,
            error: error instanceof Error ? error.message : 'Failed to add reaction'
          };
        });

        throw error;
      }
    },

    /**
     * Remove user's reaction from a message
     */
    async removeReaction(
      messageId: string,
      relayUrl: string
    ): Promise<void> {
      const auth = get(authStore);
      if (!auth.publicKey) {
        throw new Error('Not authenticated');
      }

      update(state => {
        const existing = state.reactionsByMessage.get(messageId) || [];
        const filtered = existing.filter(r => r.reactorPubkey !== auth.publicKey);

        state.reactionsByMessage.set(messageId, filtered);

        return { ...state };
      });

      // Note: NIP-25 doesn't specify reaction deletion
      // This is client-side only for now
    },

    /**
     * Subscribe to real-time reaction updates for messages
     */
    async subscribeToReactions(
      messageIds: string[],
      relayUrl: string
    ): Promise<void> {
      if (messageIds.length === 0) return;

      const filter: Filter = {
        kinds: [EventKind.REACTION],
        '#e': messageIds,
        since: Math.floor(Date.now() / 1000),
      };

      const subId = await subscribeToRelay(relayUrl, [filter], (event) => {
        const reactionData = parseReactionEvent(event);
        if (!reactionData) return;

        update(state => {
          const existing = state.reactionsByMessage.get(reactionData.eventId) || [];

          const isDuplicate = existing.some(
            r => r.reactionEventId === reactionData.reactionEventId
          );

          if (!isDuplicate) {
            const updated = [...existing, reactionData];
            state.reactionsByMessage.set(reactionData.eventId, updated);
          }

          return { ...state };
        });
      });

      // Track subscription
      update(state => {
        const subs = state.activeSubscriptions.get(relayUrl) || [];
        state.activeSubscriptions.set(relayUrl, [...subs, subId]);
        return { ...state };
      });
    },

    /**
     * Unsubscribe from reaction updates
     */
    unsubscribe(relayUrl: string): void {
      const state = get({ subscribe });
      const subs = state.activeSubscriptions.get(relayUrl);

      if (subs) {
        subs.forEach(subId => unsubscribeFromRelay(relayUrl, subId));

        update(s => {
          s.activeSubscriptions.delete(relayUrl);
          return { ...s };
        });
      }
    },

    /**
     * Get reaction summary for a message
     */
    getReactionSummary(messageId: string): ReactionSummary {
      const state = get({ subscribe });
      const reactions = state.reactionsByMessage.get(messageId) || [];
      const auth = get(authStore);

      const grouped = groupReactionsByContent(reactions);
      const reactionMap = new Map<string, ReactionInfo>();

      for (const [content, reactors] of grouped.entries()) {
        reactionMap.set(content, {
          content,
          count: reactors.length,
          reactors,
          userReacted: auth.publicKey ? reactors.includes(auth.publicKey) : false,
        });
      }

      const userReaction = auth.publicKey
        ? getUserReaction(reactions, auth.publicKey)?.content || null
        : null;

      return {
        messageId,
        reactions: reactionMap,
        totalCount: reactions.length,
        userReaction: userReaction ? normalizeReactionContent(userReaction) : null,
      };
    },

    /**
     * Clear error
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Clear all reactions
     */
    clear(): void {
      set(initialState);
    },

    /**
     * Disconnect from all relays
     */
    disconnectAll(): void {
      relayConnections.forEach(connection => {
        if (connection.ws?.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      });

      relayConnections.clear();
    }
  };
}

export const reactionStore = createReactionStore();

/**
 * Derived store for reaction summary by message ID
 */
export function getMessageReactions(messageId: string) {
  return derived(
    reactionStore,
    $store => reactionStore.getReactionSummary(messageId)
  );
}

/**
 * Auto-cleanup on page unload
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    reactionStore.disconnectAll();
  });
}
