import { writable, derived, get } from 'svelte/store';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent, NDKFilter, NDKRelay } from '@nostr-dev-kit/ndk';
import type { ChannelSection, ChannelVisibility } from '$lib/types/channel';

// Channel interface as per SPARC specification
export interface Channel {
  id: string;                                    // h tag value (group ID)
  name: string;                                  // From kind 39000 metadata
  description: string;
  picture?: string;                              // Avatar URL
  cohorts: ('business' | 'members')[];
  section: ChannelSection;                       // Section category
  visibility: ChannelVisibility;                 // Visibility within section
  isEncrypted: boolean;                          // E2E vs transport only
  memberCount: number;
  createdAt: number;

  // User-specific state
  isMember: boolean;
  hasRequestPending: boolean;
}

// Store state interface
export interface ChannelStore {
  channels: Channel[];
  loading: boolean;
  error: string | null;
  currentChannel: Channel | null;
}

// NIP-29 event kinds
const KIND_GROUP_METADATA = 39000;    // Group metadata event
const KIND_GROUP_MEMBERS = 39002;     // Group member list
const KIND_JOIN_REQUEST = 9021;       // Custom: user join requests

// Initial state
const initialState: ChannelStore = {
  channels: [],
  loading: false,
  error: null,
  currentChannel: null,
};

// Create the writable store
const { subscribe, set, update } = writable<ChannelStore>(initialState);

/**
 * Fetch all channels from relay with cohort filtering
 *
 * @param ndk - NDK instance connected to relay
 * @param userPubkey - Current user's public key
 * @param userCohorts - User's cohort tags (business, members, or both)
 * @returns Promise<Channel[]>
 */
export async function fetchChannels(
  ndk: NDK,
  userPubkey: string,
  userCohorts: ('business' | 'members')[]
): Promise<Channel[]> {
  update(state => ({ ...state, loading: true, error: null }));

  try {
    // 1. Fetch all group metadata events (kind 39000)
    const metadataFilter: NDKFilter = {
      kinds: [KIND_GROUP_METADATA],
    };

    const metadataEvents = await ndk.fetchEvents(metadataFilter);
    const metadataArray = Array.from(metadataEvents);

    // 2. Fetch all member lists (kind 39002)
    const memberFilter: NDKFilter = {
      kinds: [KIND_GROUP_MEMBERS],
    };

    const memberEvents = await ndk.fetchEvents(memberFilter);
    const memberArray = Array.from(memberEvents);

    // 3. Fetch user's pending join requests (kind 9021)
    const requestFilter: NDKFilter = {
      kinds: [KIND_JOIN_REQUEST],
      authors: [userPubkey],
    };

    const pendingRequests = await ndk.fetchEvents(requestFilter);
    const requestArray = Array.from(pendingRequests);

    // 4. Build Channel objects
    const channels: Channel[] = [];

    for (const metaEvent of metadataArray) {
      const channel = buildChannelFromEvents(
        metaEvent,
        memberArray,
        requestArray,
        userPubkey,
        userCohorts
      );

      if (channel) {
        channels.push(channel);
      }
    }

    // 5. Update store with fetched channels
    update(state => ({
      ...state,
      channels,
      loading: false,
      error: null,
    }));

    return channels;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch channels';

    update(state => ({
      ...state,
      loading: false,
      error: errorMessage,
    }));

    throw error;
  }
}

/**
 * Build a Channel object from relay events with cohort filtering
 *
 * @param metaEvent - kind 39000 group metadata event
 * @param memberEvents - Array of kind 39002 member list events
 * @param requestEvents - Array of kind 9021 join request events
 * @param userPubkey - Current user's public key
 * @param userCohorts - User's cohort memberships
 * @returns Channel | null (null if user shouldn't see this channel)
 */
function buildChannelFromEvents(
  metaEvent: NDKEvent,
  memberEvents: NDKEvent[],
  requestEvents: NDKEvent[],
  userPubkey: string,
  userCohorts: ('business' | 'members')[]
): Channel | null {
  // Extract group ID from 'd' tag
  const groupId = metaEvent.tags.find(t => t[0] === 'd')?.[1];
  if (!groupId) return null;

  // Extract cohort tags
  const channelCohorts = metaEvent.tags
    .filter(t => t[0] === 'cohort')
    .map(t => t[1] as 'business' | 'members');

  // Apply cohort filtering logic as per SPARC:
  // - business cohort sees business channels
  // - members sees members channels
  // - dual-cohort users see all (unified view)
  const hasMatchingCohort = channelCohorts.some(channelCohort =>
    userCohorts.includes(channelCohort)
  );

  // If no cohort match and user isn't dual-cohort, filter out
  if (!hasMatchingCohort && channelCohorts.length > 0) {
    return null;
  }

  // Parse metadata content
  let metadata: {
    name?: string;
    about?: string;
    picture?: string;
  } = {};

  try {
    metadata = JSON.parse(metaEvent.content);
  } catch {
    // If content isn't valid JSON, use defaults
    metadata = {};
  }

  // Find matching member list event
  const memberEvent = memberEvents.find(m => {
    const memberGroupId = m.tags.find(t => t[0] === 'd')?.[1];
    return memberGroupId === groupId;
  });

  // Extract member pubkeys
  const memberPubkeys = memberEvent?.tags
    .filter(t => t[0] === 'p')
    .map(t => t[1]) || [];

  const memberCount = memberPubkeys.length;
  const isMember = memberPubkeys.includes(userPubkey);

  // Check if user has pending request for this channel
  const hasRequestPending = requestEvents.some(r => {
    const requestChannelId = r.tags.find(t => t[0] === 'h')?.[1];
    return requestChannelId === groupId;
  });

  // Extract section tag (default to public-lobby)
  const sectionTag = metaEvent.tags.find(t => t[0] === 'section')?.[1];
  const section = (sectionTag as ChannelSection) || 'public-lobby';

  // Extract visibility setting (default to public)
  const visibilityTag = metaEvent.tags.find(t => t[0] === 'visibility')?.[1];
  const visibility = (visibilityTag as ChannelVisibility) || 'public';

  // Check if channel is encrypted (E2E)
  const isEncrypted = metaEvent.tags.some(t => t[0] === 'encrypted');

  // Handle visibility filtering for non-members (cohort channels are invisible to non-cohort users)
  if (!isMember && visibility === 'cohort') {
    return null;  // Cohort channels hidden from non-assigned users
  }

  return {
    id: groupId,
    name: metadata.name || 'Unnamed Channel',
    description: metadata.about || '',
    picture: metadata.picture,
    cohorts: channelCohorts,
    section,
    visibility,
    isEncrypted,
    memberCount,
    createdAt: metaEvent.created_at || 0,
    isMember,
    hasRequestPending,
  };
}

/**
 * Set the current active channel
 */
export function setCurrentChannel(channel: Channel | null): void {
  update(state => ({
    ...state,
    currentChannel: channel,
  }));
}

/**
 * Get current channel (synchronous)
 */
export function getCurrentChannel(): Channel | null {
  return get(channelStore).currentChannel;
}

// Lazy-initialized derived stores to avoid circular initialization
let _memberChannels: ReturnType<typeof derived<typeof channelStore, Channel[]>> | null = null;
let _availableChannels: ReturnType<typeof derived<typeof channelStore, Channel[]>> | null = null;

/**
 * Filter channels by membership status (lazy initialization)
 */
export function getMemberChannels() {
  if (!_memberChannels) {
    _memberChannels = derived(channelStore, $store => $store.channels.filter(c => c.isMember));
  }
  return _memberChannels;
}

/**
 * Filter channels by non-membership (lazy initialization)
 */
export function getAvailableChannels() {
  if (!_availableChannels) {
    _availableChannels = derived(channelStore, $store => $store.channels.filter(c => !c.isMember && c.visibility === 'public'));
  }
  return _availableChannels;
}

// Backwards-compatible exports
export const memberChannels = {
  subscribe: (fn: (value: Channel[]) => void) => getMemberChannels().subscribe(fn)
};

export const availableChannels = {
  subscribe: (fn: (value: Channel[]) => void) => getAvailableChannels().subscribe(fn)
};

/**
 * Filter channels by cohort
 */
export function getChannelsByCohort(cohort: 'business' | 'members'): Channel[] {
  const state = get(channelStore);
  return state.channels.filter(c => c.cohorts.includes(cohort));
}

/**
 * Filter channels by section
 */
export function getChannelsBySection(section: ChannelSection): Channel[] {
  const state = get(channelStore);
  return state.channels.filter(c => c.section === section);
}

// Lazy-initialized derived stores for section filtering
let _publicLobbyChannels: ReturnType<typeof derived<typeof channelStore, Channel[]>> | null = null;
let _communityRoomsChannels: ReturnType<typeof derived<typeof channelStore, Channel[]>> | null = null;
let _creativeChannels: ReturnType<typeof derived<typeof channelStore, Channel[]>> | null = null;

/**
 * Get channels for public-lobby section (lazy initialization)
 */
export function getPublicLobbyChannels() {
  if (!_publicLobbyChannels) {
    _publicLobbyChannels = derived(channelStore, $store =>
      $store.channels.filter(c => c.section === 'public-lobby')
    );
  }
  return _publicLobbyChannels;
}

/**
 * Get channels for community-rooms section (lazy initialization)
 */
export function getCommunityRoomsChannels() {
  if (!_communityRoomsChannels) {
    _communityRoomsChannels = derived(channelStore, $store =>
      $store.channels.filter(c => c.section === 'community-rooms')
    );
  }
  return _communityRoomsChannels;
}

/**
 * Get channels for creative section (lazy initialization)
 */
export function getCreativeChannels() {
  if (!_creativeChannels) {
    _creativeChannels = derived(channelStore, $store =>
      $store.channels.filter(c => c.section === 'creative')
    );
  }
  return _creativeChannels;
}

// Backwards-compatible exports for section filtering
export const publicLobbyChannels = {
  subscribe: (fn: (value: Channel[]) => void) => getPublicLobbyChannels().subscribe(fn)
};

export const communityRoomsChannels = {
  subscribe: (fn: (value: Channel[]) => void) => getCommunityRoomsChannels().subscribe(fn)
};

export const creativeChannels = {
  subscribe: (fn: (value: Channel[]) => void) => getCreativeChannels().subscribe(fn)
};

/**
 * Clear all channels (e.g., on logout)
 */
export function clearChannels(): void {
  set(initialState);
}

/**
 * Update a single channel in the store
 */
export function updateChannel(channelId: string, updates: Partial<Channel>): void {
  update(state => ({
    ...state,
    channels: state.channels.map(c =>
      c.id === channelId ? { ...c, ...updates } : c
    ),
  }));
}

/**
 * Remove a channel from the store
 */
export function removeChannel(channelId: string): void {
  update(state => ({
    ...state,
    channels: state.channels.filter(c => c.id !== channelId),
    currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
  }));
}

// Export the store
export const channelStore = {
  subscribe,
  set,
  update,
  fetchChannels,
  setCurrentChannel,
  getCurrentChannel,
  getChannelsByCohort,
  getChannelsBySection,
  clearChannels,
  updateChannel,
  removeChannel,
};
