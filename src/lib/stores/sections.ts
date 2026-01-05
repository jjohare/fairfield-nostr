/**
 * Section Access Store
 *
 * Manages user access to channel sections (areas).
 *
 * Access Model:
 * - public-lobby: Auto-approved for all authenticated users
 * - community-rooms: Requires admin approval
 * - creative: Requires admin approval
 *
 * Flow:
 * 1. User sees section stats/preview
 * 2. User clicks "Request Access"
 * 3. Admin receives notification (kind 9022 event)
 * 4. Admin approves via whitelist update
 * 5. User receives DM notification of approval
 * 6. User can now see/join public channels in section
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type {
  ChannelSection,
  SectionAccessStatus,
  UserSectionAccess,
  SectionStats,
  SectionAccessRequest,
  SECTION_CONFIG
} from '$lib/types/channel';
import { currentPubkey, isAdminVerified } from './user';
import { notificationStore } from './notifications';

// NIP event kinds for section access
const KIND_SECTION_REQUEST = 9022;     // User requests section access
const KIND_SECTION_APPROVAL = 9023;    // Admin approves section access
const KIND_SECTION_STATS = 30079;      // Section statistics (replaceable)

/**
 * Storage key for caching section access
 */
const STORAGE_KEY = 'nostr_bbs_section_access';

/**
 * Section access store state
 */
interface SectionAccessState {
  access: UserSectionAccess[];
  pendingRequests: SectionAccessRequest[];  // For admins: incoming requests
  stats: SectionStats[];
  loading: boolean;
  error: string | null;
}

const initialState: SectionAccessState = {
  access: [
    // public-lobby is auto-approved for all authenticated users
    { section: 'public-lobby', status: 'approved' }
  ],
  pendingRequests: [],
  stats: [],
  loading: false,
  error: null
};

/**
 * Load section access from localStorage
 */
function loadFromStorage(): SectionAccessState {
  if (!browser) return initialState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure public-lobby is always approved
      const hasGuestsAccess = parsed.access?.some(
        (a: UserSectionAccess) => a.section === 'public-lobby'
      );
      if (!hasGuestsAccess) {
        parsed.access = [
          { section: 'public-lobby', status: 'approved' },
          ...(parsed.access || [])
        ];
      }
      return { ...initialState, ...parsed };
    }
  } catch (error) {
    console.error('[Sections] Failed to load from storage:', error);
  }

  return initialState;
}

/**
 * Save section access to localStorage
 */
function saveToStorage(state: SectionAccessState): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      access: state.access,
      stats: state.stats
    }));
  } catch (error) {
    console.error('[Sections] Failed to save to storage:', error);
  }
}

/**
 * Create the section access store
 */
function createSectionStore() {
  const { subscribe, set, update } = writable<SectionAccessState>(loadFromStorage());

  // Persist changes
  subscribe(state => saveToStorage(state));

  return {
    subscribe,

    /**
     * Get user's access status for a section
     */
    getAccessStatus(section: ChannelSection): SectionAccessStatus {
      const state = get({ subscribe });
      const access = state.access.find(a => a.section === section);
      return access?.status || 'none';
    },

    /**
     * Check if user can access a section
     */
    canAccessSection(section: ChannelSection): boolean {
      return this.getAccessStatus(section) === 'approved';
    },

    /**
     * Request access to a section (sends event to relay)
     */
    async requestSectionAccess(
      section: ChannelSection,
      message?: string
    ): Promise<{ success: boolean; error?: string }> {
      const pubkey = get(currentPubkey);
      if (!pubkey) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if already has access or pending request
      const currentStatus = this.getAccessStatus(section);
      if (currentStatus === 'approved') {
        return { success: false, error: 'Already have access to this section' };
      }
      if (currentStatus === 'pending') {
        return { success: false, error: 'Request already pending' };
      }

      // For public-lobby, auto-approve
      if (section === 'public-lobby') {
        update(state => ({
          ...state,
          access: [
            ...state.access.filter(a => a.section !== section),
            { section, status: 'approved', approvedAt: Date.now() }
          ]
        }));
        return { success: true };
      }

      // Update local state to pending
      update(state => ({
        ...state,
        access: [
          ...state.access.filter(a => a.section !== section),
          { section, status: 'pending', requestedAt: Date.now() }
        ]
      }));

      // Publish kind 9022 event to relay
      const { requestSectionAccess } = await import('$lib/nostr/sections');
      const result = await requestSectionAccess(section, message);

      if (!result.success) {
        // Rollback local state on failure
        update(state => ({
          ...state,
          access: state.access.filter(a => !(a.section === section && a.status === 'pending'))
        }));
        return { success: false, error: result.error };
      }

      return { success: true };
    },

    /**
     * Admin: Approve a section access request
     */
    async approveRequest(
      request: SectionAccessRequest
    ): Promise<{ success: boolean; error?: string }> {
      const isAdmin = get(isAdminVerified);
      if (!isAdmin) {
        return { success: false, error: 'Admin access required' };
      }

      // Remove from pending requests
      update(state => ({
        ...state,
        pendingRequests: state.pendingRequests.filter(r => r.id !== request.id)
      }));

      // Publish kind 9023 approval event and send DM notification
      const { approveSectionAccess } = await import('$lib/nostr/sections');
      const result = await approveSectionAccess(request);

      if (!result.success) {
        // Rollback: add request back to pending
        update(state => ({
          ...state,
          pendingRequests: [request, ...state.pendingRequests]
        }));
        return { success: false, error: result.error };
      }

      return { success: true };
    },

    /**
     * Admin: Deny a section access request
     */
    async denyRequest(
      request: SectionAccessRequest,
      reason?: string
    ): Promise<{ success: boolean; error?: string }> {
      const isAdmin = get(isAdminVerified);
      if (!isAdmin) {
        return { success: false, error: 'Admin access required' };
      }

      // Remove from pending requests
      update(state => ({
        ...state,
        pendingRequests: state.pendingRequests.filter(r => r.id !== request.id)
      }));

      // Send DM explaining denial if reason provided
      if (reason) {
        try {
          const { ndk } = await import('$lib/nostr/relay');
          const { NDKEvent } = await import('@nostr-dev-kit/ndk');
          const ndkInstance = ndk();
          if (!ndkInstance) {
            console.error('[Sections] NDK not initialized for DM');
            return { success: true }; // Don't fail the denial
          }
          const signer = ndkInstance.signer;

          if (signer) {
            interface NDKUser {
              pubkey: string;
            }

            const dmEvent = new NDKEvent(ndkInstance);
            dmEvent.kind = 4; // NIP-04 encrypted DM
            dmEvent.tags = [['p', request.requesterPubkey]];
            // Create NDKUser for encryption
            const recipientUser = ndkInstance.getUser({ pubkey: request.requesterPubkey });
            dmEvent.content = await signer.encrypt(
              recipientUser,
              `Your access request for ${request.section} has been denied. Reason: ${reason}`
            );
            await dmEvent.sign(signer);
            await dmEvent.publish();
          }
        } catch (error) {
          console.error('[Sections] Failed to send denial DM:', error);
          // Don't fail the denial operation if DM fails
        }
      }

      return { success: true };
    },

    /**
     * Add a pending request (for admin view)
     */
    addPendingRequest(request: SectionAccessRequest): void {
      update(state => ({
        ...state,
        pendingRequests: [
          request,
          ...state.pendingRequests.filter(r => r.id !== request.id)
        ]
      }));

      // Notify admin
      notificationStore.addNotification(
        'join-request',
        `New access request for ${request.section}`,
        {
          senderPubkey: request.requesterPubkey,
          url: `/admin?tab=section-requests`
        }
      );
    },

    /**
     * Update section access (e.g., when receiving approval event)
     */
    setAccess(access: UserSectionAccess): void {
      update(state => ({
        ...state,
        access: [
          ...state.access.filter(a => a.section !== access.section),
          access
        ]
      }));
    },

    /**
     * Update section stats
     */
    updateStats(stats: SectionStats): void {
      update(state => ({
        ...state,
        stats: [
          ...state.stats.filter(s => s.section !== stats.section),
          stats
        ]
      }));
    },

    /**
     * Get stats for a section
     */
    getStats(section: ChannelSection): SectionStats | undefined {
      const state = get({ subscribe });
      return state.stats.find(s => s.section === section);
    },

    /**
     * Clear all section access (e.g., on logout)
     */
    clear(): void {
      set(initialState);
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    /**
     * Refresh section access from relay
     */
    async refresh(): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const pubkey = get(currentPubkey);
        const isAdmin = get(isAdminVerified);

        // Fetch section stats from relay
        const { fetchSectionStats, fetchUserAccess, fetchPendingRequests } =
          await import('$lib/nostr/sections');

        const [stats, userAccess, adminRequests] = await Promise.all([
          fetchSectionStats(),
          pubkey ? fetchUserAccess(pubkey) : Promise.resolve([]),
          isAdmin ? fetchPendingRequests() : Promise.resolve([])
        ]);

        update(state => ({
          ...state,
          stats,
          access: userAccess.length > 0 ? userAccess : state.access,
          pendingRequests: isAdmin ? adminRequests : state.pendingRequests,
          loading: false
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh';
        update(state => ({ ...state, loading: false, error: errorMessage }));
      }
    }
  };
}

export const sectionStore = createSectionStore();

/**
 * Derived store: sections user can access
 */
export const accessibleSections = derived(
  sectionStore,
  $store => $store.access.filter(a => a.status === 'approved').map(a => a.section)
);

/**
 * Derived store: sections with pending requests
 */
export const pendingSections = derived(
  sectionStore,
  $store => $store.access.filter(a => a.status === 'pending').map(a => a.section)
);

/**
 * Derived store: admin pending requests count
 */
export const pendingRequestCount = derived(
  sectionStore,
  $store => $store.pendingRequests.length
);

/**
 * Check if user can see a channel based on section access and visibility
 */
export function canSeeChannel(
  section: ChannelSection,
  visibility: 'public' | 'cohort',
  userCohorts: string[]
): boolean {
  const hasAccess = sectionStore.canAccessSection(section);

  if (!hasAccess) {
    return false;
  }

  if (visibility === 'public') {
    return true;
  }

  // For cohort channels, user must be explicitly assigned
  // This is handled by the channel store based on cohort tags
  return false;
}
