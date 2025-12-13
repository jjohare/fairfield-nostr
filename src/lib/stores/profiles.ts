import { writable, derived, get } from 'svelte/store';
import { ndkStore } from './ndk';
import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

/**
 * Profile cache entry
 */
export interface CachedProfile {
  pubkey: string;
  profile: NDKUserProfile | null;
  displayName: string;
  avatar: string | null;
  nip05: string | null;
  about: string | null;
  lastFetched: number;
  isFetching: boolean;
}

/**
 * Profile cache store
 * Caches user profiles fetched from NDK with automatic expiration
 */
interface ProfileCacheState {
  profiles: Map<string, CachedProfile>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

function createProfileCache() {
  const { subscribe, update, set } = writable<ProfileCacheState>({
    profiles: new Map()
  });

  /**
   * Get cached profile or fetch if needed
   */
  async function getProfile(pubkey: string): Promise<CachedProfile> {
    const state = get({ subscribe });
    const cached = state.profiles.get(pubkey);
    const now = Date.now();

    // Return cached if still valid
    if (cached && now - cached.lastFetched < CACHE_DURATION && !cached.isFetching) {
      return cached;
    }

    // If already fetching, return the current state
    if (cached?.isFetching) {
      return cached;
    }

    // Mark as fetching
    const fetchingEntry: CachedProfile = {
      pubkey,
      profile: null,
      displayName: truncatePubkey(pubkey),
      avatar: null,
      nip05: null,
      about: null,
      lastFetched: 0,
      isFetching: true
    };

    update(state => {
      state.profiles.set(pubkey, fetchingEntry);
      return state;
    });

    // Fetch from NDK
    try {
      const ndk = ndkStore.get();
      if (!ndk) {
        throw new Error('NDK not initialized');
      }

      const user: NDKUser = ndk.getUser({ pubkey });
      await user.fetchProfile();

      const profile = user.profile;
      const entry: CachedProfile = {
        pubkey,
        profile: profile || null,
        displayName: profile?.displayName || profile?.name || truncatePubkey(pubkey),
        avatar: profile?.image || profile?.picture || null,
        nip05: profile?.nip05 || null,
        about: profile?.about || null,
        lastFetched: now,
        isFetching: false
      };

      update(state => {
        // Limit cache size
        if (state.profiles.size >= MAX_CACHE_SIZE) {
          const oldestKey = Array.from(state.profiles.entries())
            .sort((a, b) => a[1].lastFetched - b[1].lastFetched)[0]?.[0];
          if (oldestKey) {
            state.profiles.delete(oldestKey);
          }
        }

        state.profiles.set(pubkey, entry);
        return state;
      });

      return entry;
    } catch (error) {
      console.error(`Failed to fetch profile for ${pubkey}:`, error);

      const fallbackEntry: CachedProfile = {
        pubkey,
        profile: null,
        displayName: truncatePubkey(pubkey),
        avatar: null,
        nip05: null,
        about: null,
        lastFetched: now,
        isFetching: false
      };

      update(state => {
        state.profiles.set(pubkey, fallbackEntry);
        return state;
      });

      return fallbackEntry;
    }
  }

  /**
   * Get cached profile synchronously (returns null if not cached)
   */
  function getCachedSync(pubkey: string): CachedProfile | null {
    const state = get({ subscribe });
    return state.profiles.get(pubkey) || null;
  }

  /**
   * Prefetch multiple profiles
   */
  async function prefetchProfiles(pubkeys: string[]): Promise<void> {
    const uniquePubkeys = [...new Set(pubkeys)];
    await Promise.all(uniquePubkeys.map(pk => getProfile(pk)));
  }

  /**
   * Clear cache
   */
  function clear(): void {
    set({ profiles: new Map() });
  }

  /**
   * Remove specific profile from cache
   */
  function remove(pubkey: string): void {
    update(state => {
      state.profiles.delete(pubkey);
      return state;
    });
  }

  /**
   * Clean expired entries
   */
  function cleanExpired(): void {
    const now = Date.now();
    update(state => {
      for (const [pubkey, entry] of state.profiles.entries()) {
        if (now - entry.lastFetched >= CACHE_DURATION) {
          state.profiles.delete(pubkey);
        }
      }
      return state;
    });
  }

  // Auto-clean expired entries every minute
  if (browser) {
    setInterval(cleanExpired, 60 * 1000);
  }

  return {
    subscribe,
    getProfile,
    getCachedSync,
    prefetchProfiles,
    clear,
    remove
  };
}

/**
 * Truncate pubkey for display
 */
function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

export const profileCache = createProfileCache();

/**
 * Derived store for a specific profile
 */
export function createProfileStore(pubkey: string) {
  return derived(
    profileCache,
    ($cache, set) => {
      const cached = $cache.profiles.get(pubkey);
      if (cached) {
        set(cached);
      } else {
        // Trigger fetch
        profileCache.getProfile(pubkey).then(set);
      }
    },
    {
      pubkey,
      profile: null,
      displayName: truncatePubkey(pubkey),
      avatar: null,
      nip05: null,
      about: null,
      lastFetched: 0,
      isFetching: false
    } as CachedProfile
  );
}
