import { writable, get } from 'svelte/store';

export interface Draft {
  channelId: string;
  content: string;
  updatedAt: number;
  isDM?: boolean;
}

interface DraftState {
  drafts: Map<string, Draft>;
}

const STORAGE_KEY = 'fairfield-drafts';

// Load drafts from localStorage
function loadDrafts(): Map<string, Draft> {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Failed to load drafts:', error);
  }
  return new Map();
}

// Save drafts to localStorage
function persistDrafts(drafts: Map<string, Draft>) {
  if (typeof window === 'undefined') return;

  try {
    const obj = Object.fromEntries(drafts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Failed to persist drafts:', error);
  }
}

// Create the store
const initialState: DraftState = {
  drafts: loadDrafts()
};

const store = writable<DraftState>(initialState);

// Export the draft store with methods
export const draftStore = {
  subscribe: store.subscribe,

  /**
   * Save a draft for a channel or DM
   * @param channelId - The channel ID or recipient pubkey
   * @param content - The draft content
   * @param isDM - Whether this is a DM draft
   */
  saveDraft: (channelId: string, content: string, isDM = false) => {
    const trimmedContent = content.trim();

    store.update(state => {
      const newDrafts = new Map(state.drafts);

      if (trimmedContent === '') {
        // If content is empty, remove the draft
        newDrafts.delete(channelId);
      } else {
        // Save the draft
        newDrafts.set(channelId, {
          channelId,
          content,
          updatedAt: Date.now(),
          isDM
        });
      }

      persistDrafts(newDrafts);
      return { drafts: newDrafts };
    });
  },

  /**
   * Get a draft for a channel or DM
   * @param channelId - The channel ID or recipient pubkey
   * @returns The draft content or null
   */
  getDraft: (channelId: string): string | null => {
    const state = get(store);
    const draft = state.drafts.get(channelId);
    return draft ? draft.content : null;
  },

  /**
   * Clear a draft after sending
   * @param channelId - The channel ID or recipient pubkey
   */
  clearDraft: (channelId: string) => {
    store.update(state => {
      const newDrafts = new Map(state.drafts);
      newDrafts.delete(channelId);
      persistDrafts(newDrafts);
      return { drafts: newDrafts };
    });
  },

  /**
   * Get all channel IDs that have drafts
   * @returns Array of channel IDs with drafts
   */
  getDraftChannels: (): string[] => {
    const state = get(store);
    return Array.from(state.drafts.keys());
  },

  /**
   * Check if a channel has a draft
   * @param channelId - The channel ID or recipient pubkey
   * @returns Whether the channel has a draft
   */
  hasDraft: (channelId: string): boolean => {
    const state = get(store);
    return state.drafts.has(channelId);
  },

  /**
   * Get draft preview (first 50 characters)
   * @param channelId - The channel ID or recipient pubkey
   * @returns Preview text or null
   */
  getDraftPreview: (channelId: string): string | null => {
    const state = get(store);
    const draft = state.drafts.get(channelId);
    if (!draft) return null;

    const preview = draft.content.trim();
    return preview.length > 50 ? preview.slice(0, 50) + '...' : preview;
  },

  /**
   * Clear all drafts
   */
  clearAllDrafts: () => {
    store.update(() => {
      const newDrafts = new Map();
      persistDrafts(newDrafts);
      return { drafts: newDrafts };
    });
  }
};
