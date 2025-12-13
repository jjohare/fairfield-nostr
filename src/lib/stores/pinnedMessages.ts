import { writable, derived, get } from 'svelte/store';
import { isAdmin } from './user';

const STORAGE_KEY = 'fairfield-pinned-messages';
const MAX_PINNED_PER_CHANNEL = 5;

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
  const { subscribe, update } = writable<PinnedMessagesState>(loadFromStorage());

  return {
    subscribe,

    pinMessage: (channelId: string, messageId: string): boolean => {
      const userIsAdmin = get(isAdmin);
      if (!userIsAdmin) {
        console.warn('Only admins can pin messages');
        return false;
      }

      let success = false;
      update(state => {
        const channelPins = state[channelId] || [];

        if (channelPins.includes(messageId)) {
          console.warn('Message is already pinned');
          return state;
        }

        if (channelPins.length >= MAX_PINNED_PER_CHANNEL) {
          console.warn(`Cannot pin more than ${MAX_PINNED_PER_CHANNEL} messages per channel`);
          return state;
        }

        const newState = {
          ...state,
          [channelId]: [...channelPins, messageId]
        };
        saveToStorage(newState);
        success = true;
        return newState;
      });

      return success;
    },

    unpinMessage: (channelId: string, messageId: string): boolean => {
      const userIsAdmin = get(isAdmin);
      if (!userIsAdmin) {
        console.warn('Only admins can unpin messages');
        return false;
      }

      let success = false;
      update(state => {
        const channelPins = state[channelId] || [];

        if (!channelPins.includes(messageId)) {
          console.warn('Message is not pinned');
          return state;
        }

        const newState = {
          ...state,
          [channelId]: channelPins.filter(id => id !== messageId)
        };
        saveToStorage(newState);
        success = true;
        return newState;
      });

      return success;
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

export const pinnedStore = createPinnedStore();

export function getPinnedForChannel(channelId: string) {
  return derived(pinnedStore, $pinned => $pinned[channelId] || []);
}

export function isPinnedMessage(channelId: string, messageId: string) {
  return derived(pinnedStore, $pinned => {
    const channelPins = $pinned[channelId] || [];
    return channelPins.includes(messageId);
  });
}
