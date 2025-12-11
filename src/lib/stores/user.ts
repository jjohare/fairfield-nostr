import { derived, type Readable } from 'svelte/store';
import { authStore } from './auth';

/**
 * User cohort types
 */
export type CohortType = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate' | 'faculty' | 'staff' | 'alumni';

/**
 * User profile interface
 */
export interface UserProfile {
  pubkey: string;
  name: string | null;
  displayName: string | null;
  avatar: string | null;
  about: string | null;
  cohorts: CohortType[];
  isAdmin: boolean;
  isApproved: boolean;
  nip05: string | null;
  lud16: string | null; // Lightning address
  website: string | null;
  banner: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/**
 * User store state
 */
export interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Creates a default user profile from pubkey
 */
function createDefaultProfile(pubkey: string): UserProfile {
  return {
    pubkey,
    name: null,
    displayName: null,
    avatar: null,
    about: null,
    cohorts: [],
    isAdmin: false,
    isApproved: false,
    nip05: null,
    lud16: null,
    website: null,
    banner: null,
    createdAt: null,
    updatedAt: null
  };
}

/**
 * User store derived from auth store
 * Automatically updates when authentication state changes
 */
export const userStore: Readable<UserState> = derived(
  authStore,
  ($auth, set) => {
    // If not authenticated, clear user
    if ($auth.state !== 'authenticated' || !$auth.pubkey) {
      set({
        profile: null,
        isLoading: false,
        error: null
      });
      return;
    }

    // Create initial profile from pubkey
    const initialProfile = createDefaultProfile($auth.pubkey);

    set({
      profile: initialProfile,
      isLoading: true,
      error: null
    });

    // In a real implementation, this would fetch the full profile from Nostr relays
    // For now, we just use the default profile
    // TODO: Implement Nostr relay queries to fetch kind 0 metadata events

    // Simulate async profile loading
    const loadProfile = async () => {
      try {
        // This is where you'd query Nostr relays for:
        // - kind 0 (metadata) events for user profile
        // - kind 30023 (profile badges) for cohort information
        // - Check admin list (kind 10000 or similar)

        // For now, just set the initial profile
        set({
          profile: initialProfile,
          isLoading: false,
          error: null
        });
      } catch (error) {
        set({
          profile: initialProfile,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load profile'
        });
      }
    };

    loadProfile();
  },
  {
    profile: null,
    isLoading: false,
    error: null
  }
);

/**
 * Derived store for checking if current user is authenticated
 */
export const isAuthenticated: Readable<boolean> = derived(
  authStore,
  $auth => $auth.state === 'authenticated' && $auth.pubkey !== null
);

/**
 * Derived store for checking if current user is admin
 */
export const isAdmin: Readable<boolean> = derived(
  userStore,
  $user => $user.profile?.isAdmin ?? false
);

/**
 * Derived store for checking if current user is approved
 */
export const isApproved: Readable<boolean> = derived(
  userStore,
  $user => $user.profile?.isApproved ?? false
);

/**
 * Derived store for current user's pubkey
 */
export const currentPubkey: Readable<string | null> = derived(
  authStore,
  $auth => $auth.pubkey
);

/**
 * Derived store for current user's cohorts
 */
export const currentCohorts: Readable<CohortType[]> = derived(
  userStore,
  $user => $user.profile?.cohorts ?? []
);

/**
 * Derived store for current user's display name
 */
export const currentDisplayName: Readable<string | null> = derived(
  userStore,
  $user => $user.profile?.displayName ?? $user.profile?.name ?? null
);
