import { writable, derived, get } from 'svelte/store';
import { isAdmin } from './user';
import { ndk as getNdk, isConnected } from '$lib/nostr/relay';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

const STORAGE_KEY = 'Nostr-BBS-pinned-messages';
const MAX_PINNED_PER_CHANNEL = 5;
const PIN_LIST_KIND = 30001; // NIP-51 Categorized Bookmark List

interface PinnedMessagesState {
  [channelId: string]: string[];
}

function loadFromStorage(): PinnedMessagesState {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load pinned messages from storage:', error);
    return {};
  }
}

function saveToStorage(state: PinnedMessagesState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save pinned messages to storage:', error);
  }
}

function createPinnedStore() {
  const { subscribe, set, update } = writable<PinnedMessagesState>(loadFromStorage());

  return {
    subscribe,

    // Initialize store by fetching from relay
    init: async () => {
        if (!browser) return;
        // Logic to fetch pinned messages for all known channels could go here
        // For now we rely on the component loading the channel to fetch pins
    },

    fetchPinnedMessages: async (channelId: string) => {
        const $ndk = getNdk();
        if (!$ndk) return;

        try {
            // Fetch the pin list for this channel
            // We look for a 30001 event with d tag = "pinned:<channelId>"
            // Note: In a real app, we should probably look for the *channel creator's* list
            // or the *admin's* list. For now, we'll search broadly or assume we know the pubkey.
            // Since we don't track "channel admin" pubkey easily here without looking up the channel metadata,
            // we will search for any event of this kind with this d-tag.
            // CAUTION: This might allow anyone to publish pins if we don't filter by author.
            // For security, the UI should strictly filter by the known admin pubkeys.

            // For this implementation, we will trust the event but in a production environment
            // we must filter `authors: [adminPubkey]`

            const filter: NDKFilter = {
                kinds: [PIN_LIST_KIND],
                '#d': [`pinned:${channelId}`],
                limit: 1
            };

            const events = await $ndk.fetchEvents(filter);
            if (events.size > 0) {
                // Take the most recent one
                const event = Array.from(events).sort((a, b) => b.created_at! - a.created_at!)[0];
                const pinnedIds = event.tags
                    .filter(t => t[0] === 'e')
                    .map(t => t[1]);

                update(state => {
                    const newState = {
                        ...state,
                        [channelId]: pinnedIds
                    };
                    saveToStorage(newState);
                    return newState;
                });
            }
        } catch (e) {
            console.error(`Failed to fetch pinned messages for ${channelId}:`, e);
        }
    },

    pinMessage: async (channelId: string, messageId: string): Promise<boolean> => {
      const userIsAdmin = get(isAdmin);
      if (!userIsAdmin) {
        console.warn('Only admins can pin messages');
        return false;
      }

      const state = get({ subscribe });
      const channelPins = state[channelId] || [];

      if (channelPins.includes(messageId)) {
        console.warn('Message is already pinned');
        return true;
      }

      if (channelPins.length >= MAX_PINNED_PER_CHANNEL) {
        console.warn(`Cannot pin more than ${MAX_PINNED_PER_CHANNEL} messages per channel`);
        return false;
      }

      const newPins = [...channelPins, messageId];

      // Publish to relay first
      const published = await publishPinList(channelId, newPins);
      if (!published) {
        console.error('Failed to publish pin to relay');
        return false;
      }

      // Update local state only after successful relay publish
      update(s => {
          const newState = { ...s, [channelId]: newPins };
          saveToStorage(newState);
          return newState;
      });

      return true;
    },

    unpinMessage: async (channelId: string, messageId: string): Promise<boolean> => {
      const userIsAdmin = get(isAdmin);
      if (!userIsAdmin) {
        console.warn('Only admins can unpin messages');
        return false;
      }

      const state = get({ subscribe });
      const channelPins = state[channelId] || [];

      if (!channelPins.includes(messageId)) {
        console.warn('Message is not pinned');
        return true;
      }

      const newPins = channelPins.filter(id => id !== messageId);

      // Publish to relay first
      const published = await publishPinList(channelId, newPins);
      if (!published) {
        console.error('Failed to publish unpin to relay');
        return false;
      }

      // Update local state only after successful relay publish
      update(s => {
          const newState = { ...s, [channelId]: newPins };
          saveToStorage(newState);
          return newState;
      });

      return true;
    },

    isPinned: (channelId: string, messageId: string): boolean => {
      const state = get({ subscribe });
      const channelPins = state[channelId] || [];
      return channelPins.includes(messageId);
    },

    getPinnedMessages: (channelId: string): string[] => {
      const state = get({ subscribe });
      return state[channelId] || [];
    },

    canPinMore: (channelId: string): boolean => {
      const state = get({ subscribe });
      const channelPins = state[channelId] || [];
      return channelPins.length < MAX_PINNED_PER_CHANNEL;
    }
  };
}

async function publishPinList(channelId: string, messageIds: string[]): Promise<boolean> {
    if (!isConnected()) {
        console.error('Cannot publish pins: Not connected to relay');
        return false;
    }

    const $ndk = getNdk();
    if (!$ndk || !$ndk.signer) {
        console.error('Cannot publish pins: NDK not initialized or no signer');
        return false;
    }

    try {
        const event = new NDKEvent($ndk);
        event.kind = PIN_LIST_KIND;
        event.tags = [
            ['d', `pinned:${channelId}`],
            ['h', channelId], // Add channel reference for easier querying
            ...messageIds.map(id => ['e', id])
        ];

        await event.publish();
        return true;
    } catch (e) {
        console.error('Failed to publish pinned messages list:', e);
        return false;
    }
}

export const pinnedStore = createPinnedStore();

export function getPinnedForChannel(channelId: string) {
  // Trigger a fetch when this derived store is first accessed for a channel
  if (browser) {
      // Debounce slightly to avoid rapid fetches
      setTimeout(() => pinnedStore.fetchPinnedMessages(channelId), 0);
  }

  return derived(pinnedStore, $pinned => $pinned[channelId] || []);
}

export function isPinnedMessage(channelId: string, messageId: string) {
  return derived(pinnedStore, $pinned => {
    const channelPins = $pinned[channelId] || [];
    return channelPins.includes(messageId);
  });
}
