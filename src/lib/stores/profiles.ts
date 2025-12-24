import { writable, derived, get } from 'svelte/store';
import { ndkStore } from './ndk';
import { authStore } from './auth';
import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import { AsyncThrottle } from '$lib/utils/asyncHelpers';
import { KIND_USER_REGISTRATION } from '$lib/nostr/groups';

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
const MAX_CONCURRENT_FETCHES = 5;

// Throttle concurrent profile fetches to prevent overwhelming relays
const profileFetchThrottle = new AsyncThrottle<NDKUserProfile | null>(MAX_CONCURRENT_FETCHES);

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
      const profiles = new Map(state.profiles);
      profiles.set(pubkey, fetchingEntry);
      return { ...state, profiles };
    });

    // Fetch from NDK with throttling
    try {
      const ndk = ndkStore.get();
      if (!ndk) {
        // NDK not ready yet - return placeholder without throwing
        console.debug('[ProfileCache] NDK not initialized, returning placeholder for', pubkey.slice(0, 8));
        const placeholder: CachedProfile = {
          pubkey,
          profile: null,
          displayName: truncatePubkey(pubkey),
          avatar: null,
          nip05: null,
          about: null,
          lastFetched: 0, // Will retry on next fetch
          isFetching: false
        };
        update(state => {
          const profiles = new Map(state.profiles);
          profiles.set(pubkey, placeholder);
          return { ...state, profiles };
        });
        return placeholder;
      }

      // Throttle concurrent fetches to prevent overwhelming relays
      const profile = await profileFetchThrottle.execute(async () => {
        const user: NDKUser = ndk.getUser({ pubkey });
        await user.fetchProfile();
        return user.profile || null;
      });

      // For current user, prefer local nickname from authStore over relay data
      const auth = get(authStore);
      const isCurrentUser = auth.publicKey === pubkey;
      const localNickname = isCurrentUser ? auth.nickname : null;
      const localAvatar = isCurrentUser ? auth.avatar : null;

      // If no displayName from kind 0 profile, check for registration event
      let registrationName: string | null = null;
      if (!profile?.displayName && !profile?.name && !localNickname) {
        try {
          const registrationEvents = await ndk.fetchEvents({
            kinds: [KIND_USER_REGISTRATION as number],
            authors: [pubkey],
            limit: 1
          });
          const regEvent = Array.from(registrationEvents)[0];
          if (regEvent) {
            const nameTag = regEvent.tags.find(t => t[0] === 'name');
            registrationName = nameTag?.[1] || null;
          }
        } catch (e) {
          // Ignore registration fetch errors
        }
      }

      const entry: CachedProfile = {
        pubkey,
        profile: profile || null,
        displayName: localNickname || profile?.displayName || profile?.name || registrationName || truncatePubkey(pubkey),
        avatar: localAvatar || profile?.image || profile?.picture || null,
        nip05: profile?.nip05 || null,
        about: profile?.about || null,
        lastFetched: now,
        isFetching: false
      };

      update(state => {
        const profiles = new Map(state.profiles);
        // Limit cache size
        if (profiles.size >= MAX_CACHE_SIZE) {
          const oldestKey = Array.from(profiles.entries())
            .sort((a, b) => a[1].lastFetched - b[1].lastFetched)[0]?.[0];
          if (oldestKey) {
            profiles.delete(oldestKey);
          }
        }

        profiles.set(pubkey, entry);
        return { ...state, profiles };
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
        const profiles = new Map(state.profiles);
        profiles.set(pubkey, fallbackEntry);
        return { ...state, profiles };
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
      const profiles = new Map(state.profiles);
      profiles.delete(pubkey);
      return { ...state, profiles };
    });
  }

  /**
   * Immediately update the current user's profile in cache
   * Used when user saves their profile to ensure instant UI updates
   */
  function updateCurrentUserProfile(
    pubkey: string,
    displayName: string | null,
    avatar: string | null
  ): void {
    update(state => {
      const profiles = new Map(state.profiles);
      const existing = profiles.get(pubkey);
      const entry: CachedProfile = {
        pubkey,
        profile: existing?.profile || null,
        displayName: displayName || truncatePubkey(pubkey),
        avatar: avatar || null,
        nip05: existing?.nip05 || null,
        about: existing?.about || null,
        lastFetched: Date.now(),
        isFetching: false
      };
      profiles.set(pubkey, entry);
      return { ...state, profiles };
    });
  }

  /**
   * Clean expired entries
   */
  function cleanExpired(): void {
    const now = Date.now();
    update(state => {
      const profiles = new Map(state.profiles);
      for (const [pubkey, entry] of profiles.entries()) {
        if (now - entry.lastFetched >= CACHE_DURATION) {
          profiles.delete(pubkey);
        }
      }
      return { ...state, profiles };
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
    remove,
    updateCurrentUserProfile
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
