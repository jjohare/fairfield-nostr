import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

export interface Bookmark {
  messageId: string;
  channelId: string;
  content: string;
  authorPubkey: string;
  timestamp: number;
  channelName?: string;
  createdAt: number;
}

interface BookmarksState {
  bookmarks: Record<string, Bookmark>;
}

const STORAGE_KEY = 'fairfield-bookmarks';

// Load bookmarks from localStorage
function loadBookmarks(): Record<string, Bookmark> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load bookmarks from localStorage:', error);
  }
  return {};
}

// Save bookmarks to localStorage
function saveBookmarks(bookmarks: Record<string, Bookmark>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Failed to save bookmarks to localStorage:', error);
  }
}

const initialState: BookmarksState = {
  bookmarks: loadBookmarks()
};

const store: Writable<BookmarksState> = writable<BookmarksState>(initialState);

// Export the bookmarks store with methods
export const bookmarkStore = {
  subscribe: store.subscribe,

  addBookmark: (
    messageId: string,
    channelId: string,
    content: string,
    authorPubkey: string,
    messageTimestamp: number,
    channelName?: string
  ) => {
    store.update(state => {
      const bookmark: Bookmark = {
        messageId,
        channelId,
        content,
        authorPubkey,
        timestamp: messageTimestamp,
        channelName,
        createdAt: Date.now()
      };

      const newBookmarks = {
        ...state.bookmarks,
        [messageId]: bookmark
      };

      saveBookmarks(newBookmarks);

      return {
        ...state,
        bookmarks: newBookmarks
      };
    });
  },

  removeBookmark: (messageId: string) => {
    store.update(state => {
      const newBookmarks = { ...state.bookmarks };
      delete newBookmarks[messageId];

      saveBookmarks(newBookmarks);

      return {
        ...state,
        bookmarks: newBookmarks
      };
    });
  },

  toggleBookmark: (
    messageId: string,
    channelId: string,
    content: string,
    authorPubkey: string,
    messageTimestamp: number,
    channelName?: string
  ) => {
    const state = get(store);
    if (state.bookmarks[messageId]) {
      bookmarkStore.removeBookmark(messageId);
    } else {
      bookmarkStore.addBookmark(
        messageId,
        channelId,
        content,
        authorPubkey,
        messageTimestamp,
        channelName
      );
    }
  },

  getBookmarks: (): Bookmark[] => {
    const state = get(store);
    return Object.values(state.bookmarks).sort((a, b) => b.createdAt - a.createdAt);
  },

  clearAll: () => {
    store.set({ bookmarks: {} });
    saveBookmarks({});
  }
};

// Derived store to check if a message is bookmarked
export function isBookmarked(messageId: string): Readable<boolean> {
  return derived(store, $store => !!$store.bookmarks[messageId]);
}

// Derived store to get bookmark count
export const bookmarkCount: Readable<number> = derived(
  store,
  $store => Object.keys($store.bookmarks).length
);
