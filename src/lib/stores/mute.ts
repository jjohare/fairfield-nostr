import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'fairfield-muted-users';

/**
 * Muted user entry with metadata
 */
export interface MutedUser {
  pubkey: string;
  mutedAt: number;
  reason?: string;
}

/**
 * Mute store state
 */
export interface MuteState {
  mutedUsers: Map<string, MutedUser>;
}

/**
 * Load muted users from localStorage
 */
function loadMutedUsers(): Map<string, MutedUser> {
  if (!browser) return new Map();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();

    const data: MutedUser[] = JSON.parse(stored);
    return new Map(data.map(user => [user.pubkey, user]));
  } catch (error) {
    console.error('Failed to load muted users:', error);
    return new Map();
  }
}

/**
 * Save muted users to localStorage
 */
function saveMutedUsers(mutedUsers: Map<string, MutedUser>): void {
  if (!browser) return;

  try {
    const data = Array.from(mutedUsers.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save muted users:', error);
  }
}

/**
 * Create the mute store
 */
function createMuteStore() {
  const initialState: MuteState = {
    mutedUsers: loadMutedUsers()
  };

  const { subscribe, set, update } = writable<MuteState>(initialState);

  return {
    subscribe,

    /**
     * Mute a user by pubkey
     */
    muteUser: (pubkey: string, reason?: string): void => {
      update(state => {
        const mutedUser: MutedUser = {
          pubkey,
          mutedAt: Date.now(),
          reason
        };

        const updatedMutedUsers = new Map(state.mutedUsers);
        updatedMutedUsers.set(pubkey, mutedUser);

        saveMutedUsers(updatedMutedUsers);

        return {
          ...state,
          mutedUsers: updatedMutedUsers
        };
      });
    },

    /**
     * Unmute a user by pubkey
     */
    unmuteUser: (pubkey: string): void => {
      update(state => {
        const updatedMutedUsers = new Map(state.mutedUsers);
        updatedMutedUsers.delete(pubkey);

        saveMutedUsers(updatedMutedUsers);

        return {
          ...state,
          mutedUsers: updatedMutedUsers
        };
      });
    },

    /**
     * Check if a user is muted
     */
    isMuted: (pubkey: string): boolean => {
      const state = get({ subscribe });
      return state.mutedUsers.has(pubkey);
    },

    /**
     * Get all muted users
     */
    getMutedUsers: (): MutedUser[] => {
      const state = get({ subscribe });
      return Array.from(state.mutedUsers.values()).sort((a, b) => b.mutedAt - a.mutedAt);
    },

    /**
     * Clear all muted users
     */
    clearAllMutes: (): void => {
      update(state => {
        saveMutedUsers(new Map());
        return {
          ...state,
          mutedUsers: new Map()
        };
      });
    },

    /**
     * Get count of muted users
     */
    getMutedCount: (): number => {
      const state = get({ subscribe });
      return state.mutedUsers.size;
    }
  };
}

export const muteStore = createMuteStore();

/**
 * Derived store for checking if a specific user is muted
 */
export function createIsMutedStore(pubkey: string) {
  return derived(muteStore, $mute => $mute.mutedUsers.has(pubkey));
}

/**
 * Derived store for muted users count
 */
export const mutedCount = derived(muteStore, $mute => $mute.mutedUsers.size);

/**
 * Derived store for all muted users as sorted array
 */
export const mutedUsersList = derived(muteStore, $mute =>
  Array.from($mute.mutedUsers.values()).sort((a, b) => b.mutedAt - a.mutedAt)
);
