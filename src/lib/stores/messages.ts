import { writable, get, derived } from 'svelte/store';
import { db, type DBMessage, type DBUser } from '$lib/db';
import type { Event, Filter, Sub } from '$lib/types/nostr';
import { currentPubkey } from './user';
import { toast } from './toast';

/**
 * Message author information
 */
export interface MessageAuthor {
  pubkey: string;
  name?: string;
  avatar?: string;
}

/**
 * Message interface for the application
 */
export interface Message {
  id: string;
  channelId: string;
  pubkey: string;
  content: string;
  created_at: number;
  encrypted: boolean;
  deleted: boolean;
  author: MessageAuthor;
}

/**
 * Message store state
 */
export interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  currentChannelId: string | null;
  hasMore: boolean;
  lastFetchTime: number | null;
}

/**
 * WebSocket relay connection type
 */
interface RelayConnection {
  url: string;
  ws: WebSocket | null;
  subscriptions: Map<string, Sub>;
}

/**
 * Initial message state
 */
const initialState: MessageState = {
  messages: [],
  loading: false,
  error: null,
  currentChannelId: null,
  hasMore: true,
  lastFetchTime: null
};

/**
 * Create the message store
 */
function createMessageStore() {
  const { subscribe, set, update } = writable<MessageState>(initialState);

  // Active relay connections
  const relayConnections = new Map<string, RelayConnection>();

  // Active subscriptions by channel
  const channelSubscriptions = new Map<string, string[]>();

  /**
   * Convert DB message to app message
   */
  async function dbMessageToMessage(dbMsg: DBMessage): Promise<Message> {
    const author = await db.getUser(dbMsg.pubkey);

    return {
      id: dbMsg.id,
      channelId: dbMsg.channelId,
      pubkey: dbMsg.pubkey,
      content: dbMsg.content,
      created_at: dbMsg.created_at,
      encrypted: dbMsg.encrypted,
      deleted: dbMsg.deleted,
      author: {
        pubkey: dbMsg.pubkey,
        name: author?.name || author?.displayName || undefined,
        avatar: author?.avatar || undefined
      }
    };
  }

  /**
   * Decrypt message content
   */
  async function decryptMessage(
    encryptedContent: string,
    senderPubkey: string,
    recipientPrivkey: string
  ): Promise<string> {
    try {
      const { nip04Decrypt } = await import('$lib/utils/nostr-crypto');
      return await nip04Decrypt(recipientPrivkey, senderPubkey, encryptedContent);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      // Notify user of decryption failure (only once per session to avoid spam)
      toast.warning('Some messages could not be decrypted', 5000);
      return '[Encrypted message - decryption failed]';
    }
  }

  /**
   * Encrypt message content
   */
  async function encryptMessage(
    content: string,
    recipientPubkey: string,
    senderPrivkey: string
  ): Promise<string> {
    const { nip04Encrypt } = await import('$lib/utils/nostr-crypto');
    return await nip04Encrypt(senderPrivkey, recipientPubkey, content);
  }

  /**
   * Create Nostr event
   */
  async function createEvent(
    content: string,
    kind: number,
    tags: string[][],
    privkey: string
  ): Promise<Event> {
    const { getPublicKey, getEventHash, signEvent } = await import('$lib/utils/nostr-crypto');

    const pubkey = getPublicKey(privkey);
    const created_at = Math.floor(Date.now() / 1000);

    const event: Event = {
      id: '',
      pubkey,
      created_at,
      kind,
      tags,
      content,
      sig: ''
    };

    event.id = getEventHash(event);
    event.sig = signEvent(event, privkey);

    return event;
  }

  /**
   * Connect to relay
   */
  function connectToRelay(relayUrl: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const existing = relayConnections.get(relayUrl);

      if (existing?.ws?.readyState === WebSocket.OPEN) {
        resolve(existing.ws);
        return;
      }

      const ws = new WebSocket(relayUrl);

      ws.onopen = () => {
        relayConnections.set(relayUrl, {
          url: relayUrl,
          ws,
          subscriptions: new Map()
        });

        db.updateRelay(relayUrl, {
          connected: true,
          lastConnected: Date.now() / 1000,
          lastError: null
        });

        resolve(ws);
      };

      ws.onerror = (error) => {
        db.updateRelay(relayUrl, {
          connected: false,
          lastError: 'Connection failed'
        });
        reject(error);
      };

      ws.onclose = () => {
        relayConnections.delete(relayUrl);
        db.updateRelay(relayUrl, {
          connected: false
        });
      };
    });
  }

  /**
   * Subscribe to relay events
   */
  async function subscribeToRelay(
    relayUrl: string,
    filters: Filter[],
    onEvent: (event: Event) => void
  ): Promise<string> {
    const ws = await connectToRelay(relayUrl);
    const subId = Math.random().toString(36).substring(7);

    const subscription: Sub = {
      id: subId,
      filters,
      cb: onEvent
    };

    const connection = relayConnections.get(relayUrl);
    if (connection) {
      connection.subscriptions.set(subId, subscription);
    }

    // Send subscription request
    ws.send(JSON.stringify(['REQ', subId, ...filters]));

    // Handle incoming messages
    const messageHandler = async (event: MessageEvent) => {
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
      connection.subscriptions.delete(subId);
    }
  }

  /**
   * Publish event to relay
   */
  async function publishToRelay(relayUrl: string, event: Event): Promise<void> {
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
     * Fetch messages from relay and cache
     */
    async fetchMessages(
      relayUrl: string,
      channelId: string,
      userPrivkey: string | null,
      limit: number = 50
    ): Promise<void> {
      update(state => ({ ...state, loading: true, error: null, currentChannelId: channelId }));

      try {
        // First, load from cache
        const cachedMessages = await db.getChannelMessagesWithAuthors(channelId);
        const appMessages = await Promise.all(
          cachedMessages.map(msg => dbMessageToMessage(msg))
        );

        update(state => ({
          ...state,
          messages: appMessages,
          loading: true
        }));

        // Get channel info to check if encrypted
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        // Then fetch from relay
        const since = cachedMessages.length > 0
          ? Math.max(...cachedMessages.map(m => m.created_at))
          : 0;

        const filter: Filter = {
          kinds: [9], // NIP-29 channel message
          '#e': [channelId],
          since,
          limit
        };

        await subscribeToRelay(relayUrl, [filter], async (event) => {
          // Check if already deleted
          const isDeleted = await db.isMessageDeleted(event.id);
          if (isDeleted) return;

          // Decrypt if necessary
          let content = event.content;
          if (isEncrypted && userPrivkey) {
            content = await decryptMessage(event.content, event.pubkey, userPrivkey);
          }

          // Cache message
          const dbMsg: DBMessage = {
            id: event.id,
            channelId,
            pubkey: event.pubkey,
            content,
            created_at: event.created_at,
            encrypted: isEncrypted,
            deleted: false,
            kind: event.kind,
            tags: event.tags,
            sig: event.sig
          };

          await db.messages.put(dbMsg);

          // Update store
          const appMsg = await dbMessageToMessage(dbMsg);

          update(state => {
            const exists = state.messages.some(m => m.id === appMsg.id);
            if (!exists) {
              return {
                ...state,
                messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
              };
            }
            return state;
          });
        });

        update(state => ({
          ...state,
          loading: false,
          lastFetchTime: Date.now()
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch messages';
        console.error('fetchMessages error:', error);

        // Notify user of connection issues
        toast.error(`Connection error: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg,
          loading: false
        }));
      }
    },

    /**
     * Send a message to a channel
     */
    async sendMessage(
      content: string,
      channelId: string,
      relayUrl: string,
      userPrivkey: string,
      isEncrypted: boolean = false,
      memberPubkeys: string[] = []
    ): Promise<void> {
      try {
        let finalContent = content;

        // Encrypt if necessary
        if (isEncrypted && memberPubkeys.length > 0) {
          // For group encryption, encrypt for each member
          // This is simplified - proper implementation would use NIP-44 group encryption
          finalContent = await encryptMessage(content, memberPubkeys[0], userPrivkey);
        }

        // Create tags
        const tags: string[][] = [
          ['e', channelId, relayUrl, 'root']
        ];

        // Create and sign event
        const event = await createEvent(finalContent, 9, tags, userPrivkey);

        // Publish to relay
        await publishToRelay(relayUrl, event);

        // Cache locally
        const dbMsg: DBMessage = {
          id: event.id,
          channelId,
          pubkey: event.pubkey,
          content,
          created_at: event.created_at,
          encrypted: isEncrypted,
          deleted: false,
          kind: event.kind,
          tags: event.tags,
          sig: event.sig
        };

        await db.messages.put(dbMsg);

        // Update store
        const appMsg = await dbMessageToMessage(dbMsg);

        update(state => ({
          ...state,
          messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to send message';
        console.error('sendMessage error:', error);

        // Notify user of send failure
        toast.error(`Failed to send: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));

        throw error;
      }
    },

    /**
     * Delete a message (NIP-09 deletion)
     */
    async deleteMessage(
      messageId: string,
      channelId: string,
      relayUrl: string,
      userPrivkey: string
    ): Promise<void> {
      try {
        // Create deletion event
        const tags: string[][] = [
          ['e', messageId],
          ['k', '9'] // Original event kind
        ];

        const event = await createEvent('', 5, tags, userPrivkey);

        // Publish deletion
        await publishToRelay(relayUrl, event);

        // Mark as deleted in cache
        await db.addDeletion({
          id: event.id,
          deletedEventId: messageId,
          channelId,
          deleterPubkey: event.pubkey,
          created_at: event.created_at,
          kind: 5
        });

        // Update store
        update(state => ({
          ...state,
          messages: state.messages.map(m =>
            m.id === messageId ? { ...m, deleted: true } : m
          )
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete message';
        console.error('deleteMessage error:', error);

        // Notify user of deletion failure
        toast.error(`Failed to delete: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));

        throw error;
      }
    },

    /**
     * Subscribe to real-time channel updates
     */
    async subscribeToChannel(
      channelId: string,
      relayUrl: string,
      userPrivkey: string | null
    ): Promise<void> {
      try {
        // Get channel info
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        // Subscribe to new messages
        const messageFilter: Filter = {
          kinds: [9],
          '#e': [channelId],
          since: Math.floor(Date.now() / 1000)
        };

        // Subscribe to deletions
        const deletionFilter: Filter = {
          kinds: [5, 9005], // NIP-09 and NIP-29 deletions
          '#e': [channelId],
          since: Math.floor(Date.now() / 1000)
        };

        const subId1 = await subscribeToRelay(relayUrl, [messageFilter], async (event) => {
          // Handle new message
          let content = event.content;
          if (isEncrypted && userPrivkey) {
            content = await decryptMessage(event.content, event.pubkey, userPrivkey);
          }

          const dbMsg: DBMessage = {
            id: event.id,
            channelId,
            pubkey: event.pubkey,
            content,
            created_at: event.created_at,
            encrypted: isEncrypted,
            deleted: false,
            kind: event.kind,
            tags: event.tags,
            sig: event.sig
          };

          await db.messages.put(dbMsg);

          const appMsg = await dbMessageToMessage(dbMsg);

          update(state => {
            const exists = state.messages.some(m => m.id === appMsg.id);
            if (!exists && state.currentChannelId === channelId) {
              return {
                ...state,
                messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
              };
            }
            return state;
          });
        });

        const subId2 = await subscribeToRelay(relayUrl, [deletionFilter], async (event) => {
          // Handle deletion
          const deletedId = event.tags.find(t => t[0] === 'e')?.[1];

          if (deletedId) {
            await db.addDeletion({
              id: event.id,
              deletedEventId: deletedId,
              channelId,
              deleterPubkey: event.pubkey,
              created_at: event.created_at,
              kind: event.kind
            });

            update(state => ({
              ...state,
              messages: state.messages.map(m =>
                m.id === deletedId ? { ...m, deleted: true } : m
              )
            }));
          }
        });

        // Track subscriptions
        const subs = channelSubscriptions.get(channelId) || [];
        channelSubscriptions.set(channelId, [...subs, subId1, subId2]);

      } catch (error) {
        console.error('subscribeToChannel error:', error);

        const errorMsg = error instanceof Error ? error.message : 'Failed to subscribe to channel';
        // Notify user of subscription failure
        toast.error(`Channel subscription failed: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));
      }
    },

    /**
     * Unsubscribe from channel updates
     */
    unsubscribeFromChannel(channelId: string, relayUrl: string): void {
      const subs = channelSubscriptions.get(channelId);

      if (subs) {
        subs.forEach(subId => {
          unsubscribeFromRelay(relayUrl, subId);
        });

        channelSubscriptions.delete(channelId);
      }
    },

    /**
     * Fetch older messages (pagination)
     */
    async fetchOlderMessages(
      relayUrl: string,
      channelId: string,
      userPrivkey: string | null,
      limit: number = 50
    ): Promise<boolean> {
      const currentState = get({ subscribe });

      // Get oldest message timestamp
      const oldestMessage = currentState.messages
        .filter(m => m.channelId === channelId)
        .reduce((oldest, m) => m.created_at < oldest.created_at ? m : oldest, { created_at: Infinity } as Message);

      if (oldestMessage.created_at === Infinity) {
        return false; // No messages to paginate from
      }

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        const filter: Filter = {
          kinds: [9],
          '#e': [channelId],
          until: oldestMessage.created_at - 1,
          limit
        };

        let foundMessages = 0;

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(), 5000);

          subscribeToRelay(relayUrl, [filter], async (event) => {
            const isDeleted = await db.isMessageDeleted(event.id);
            if (isDeleted) return;

            let content = event.content;
            if (isEncrypted && userPrivkey) {
              content = await decryptMessage(event.content, event.pubkey, userPrivkey);
            }

            const dbMsg: DBMessage = {
              id: event.id,
              channelId,
              pubkey: event.pubkey,
              content,
              created_at: event.created_at,
              encrypted: isEncrypted,
              deleted: false,
              kind: event.kind,
              tags: event.tags,
              sig: event.sig
            };

            await db.messages.put(dbMsg);

            const appMsg = await dbMessageToMessage(dbMsg);

            update(state => {
              const exists = state.messages.some(m => m.id === appMsg.id);
              if (!exists) {
                foundMessages++;
                return {
                  ...state,
                  messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
                };
              }
              return state;
            });
          }).catch(reject);

          // Give relay time to respond
          setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, 3000);
        });

        update(state => ({
          ...state,
          loading: false,
          hasMore: foundMessages >= limit * 0.5 // Assume more if we got at least half of requested
        }));

        return foundMessages > 0;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch older messages';
        console.error('fetchOlderMessages error:', error);

        update(state => ({
          ...state,
          error: errorMsg,
          loading: false,
          hasMore: false
        }));

        return false;
      }
    },

    /**
     * Clear error
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Clear all messages
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
      channelSubscriptions.clear();
    }
  };
}

export const messageStore = createMessageStore();

/**
 * Derived store for non-deleted messages
 */
export const activeMessages = derived(
  messageStore,
  $messages => $messages.messages.filter(m => !m.deleted)
);

/**
 * Derived store for message count
 */
export const messageCount = derived(
  activeMessages,
  $messages => $messages.length
);

/**
 * Auto-cleanup on page unload
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    messageStore.disconnectAll();
  });
}
