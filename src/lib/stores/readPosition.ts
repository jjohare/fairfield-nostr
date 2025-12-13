import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Message } from '$lib/types/channel';

interface ReadPositions {
  [channelId: string]: number; // timestamp of last read message
}

const STORAGE_KEY = 'fairfield-read-positions';

function createReadPositionStore() {
  const initialPositions: ReadPositions = browser
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    : {};

  const { subscribe, set, update } = writable<ReadPositions>(initialPositions);

  function persist(positions: ReadPositions) {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    }
  }

  return {
    subscribe,

    setLastRead: (channelId: string, timestamp: number) => {
      update(positions => {
        const updated = {
          ...positions,
          [channelId]: timestamp
        };
        persist(updated);
        return updated;
      });
    },

    getLastRead: (channelId: string): number => {
      const positions = get({ subscribe });
      return positions[channelId] || 0;
    },

    getUnreadCount: (channelId: string, messages: Message[]): number => {
      const positions = get({ subscribe });
      const lastRead = positions[channelId] || 0;

      return messages.filter(msg => msg.createdAt > lastRead).length;
    },

    markAllRead: (channelId: string, messages: Message[]) => {
      if (messages.length === 0) return;

      const latestTimestamp = Math.max(...messages.map(m => m.createdAt));
      update(positions => {
        const updated = {
          ...positions,
          [channelId]: latestTimestamp
        };
        persist(updated);
        return updated;
      });
    },

    clearChannel: (channelId: string) => {
      update(positions => {
        const updated = { ...positions };
        delete updated[channelId];
        persist(updated);
        return updated;
      });
    },

    clearAll: () => {
      set({});
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };
}

export const lastReadStore = createReadPositionStore();
