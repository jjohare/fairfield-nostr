import { writable, derived } from 'svelte/store';
import type { Event as NostrEvent } from 'nostr-tools';
import type { NDKRelay } from '@nostr-dev-kit/ndk';
import type { ChannelSection } from '$lib/types/channel';

export interface PendingRequest {
  id: string;
  pubkey: string;
  channelId: string;
  channelName: string;
  timestamp: number;
  event: NostrEvent;
}

export interface User {
  pubkey: string;
  name?: string;
  cohorts: string[];
  channels: string[];
  joinedAt: number;
  lastSeen?: number;
  isBanned?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  cohorts: string[];
  visibility: 'public' | 'cohort' | 'private';
  encrypted: boolean;
  section: ChannelSection;
  createdAt: number;
  memberCount: number;
  creatorPubkey: string;
}

interface AdminState {
  pendingRequests: PendingRequest[];
  users: User[];
  channels: Channel[];
  loading: {
    requests: boolean;
    users: boolean;
    channels: boolean;
  };
  error: string | null;
}

const initialState: AdminState = {
  pendingRequests: [],
  users: [],
  channels: [],
  loading: {
    requests: false,
    users: false,
    channels: false,
  },
  error: null,
};

function createAdminStore() {
  const { subscribe, set, update } = writable<AdminState>(initialState);

  return {
    subscribe,

    setLoading: (key: keyof AdminState['loading'], value: boolean) => {
      update(state => ({
        ...state,
        loading: { ...state.loading, [key]: value }
      }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },

    setPendingRequests: (requests: PendingRequest[]) => {
      update(state => ({
        ...state,
        pendingRequests: requests,
        loading: { ...state.loading, requests: false }
      }));
    },

    removePendingRequest: (requestId: string) => {
      update(state => ({
        ...state,
        pendingRequests: state.pendingRequests.filter(r => r.id !== requestId)
      }));
    },

    setUsers: (users: User[]) => {
      update(state => ({
        ...state,
        users,
        loading: { ...state.loading, users: false }
      }));
    },

    updateUser: (pubkey: string, updates: Partial<User>) => {
      update(state => ({
        ...state,
        users: state.users.map(u =>
          u.pubkey === pubkey ? { ...u, ...updates } : u
        )
      }));
    },

    setChannels: (channels: Channel[]) => {
      update(state => ({
        ...state,
        channels,
        loading: { ...state.loading, channels: false }
      }));
    },

    addChannel: (channel: Channel) => {
      update(state => ({
        ...state,
        channels: [...state.channels, channel]
      }));
    },

    updateChannel: (channelId: string, updates: Partial<Channel>) => {
      update(state => ({
        ...state,
        channels: state.channels.map(c =>
          c.id === channelId ? { ...c, ...updates } : c
        )
      }));
    },

    deleteChannel: (channelId: string) => {
      update(state => ({
        ...state,
        channels: state.channels.filter(c => c.id !== channelId)
      }));
    },

    reset: () => set(initialState),
  };
}

export const adminStore = createAdminStore();

// Derived stores for filtered data
export const pendingRequestsByChannel = derived(
  adminStore,
  $admin => {
    const grouped = new Map<string, PendingRequest[]>();
    $admin.pendingRequests.forEach(req => {
      const existing = grouped.get(req.channelId) || [];
      grouped.set(req.channelId, [...existing, req]);
    });
    return grouped;
  }
);

export const usersByCohort = derived(
  adminStore,
  $admin => {
    const grouped = new Map<string, User[]>();
    $admin.users.forEach(user => {
      user.cohorts.forEach(cohort => {
        const existing = grouped.get(cohort) || [];
        grouped.set(cohort, [...existing, user]);
      });
    });
    return grouped;
  }
);

/**
 * Fetch pending join requests from relay
 */
export async function fetchPendingRequests(relay: NDKRelay): Promise<void> {
  adminStore.setLoading('requests', true);
  adminStore.setError(null);

  try {
    // Subscribe to kind 9021 (join request) events
    const events = await relay.querySync([{
      kinds: [9021],
      limit: 100,
    }]);

    const requests: PendingRequest[] = events.map(event => {
      const channelIdTag = event.tags.find(t => t[0] === 'e');
      const channelNameTag = event.tags.find(t => t[0] === 'name');

      return {
        id: event.id,
        pubkey: event.pubkey,
        channelId: channelIdTag?.[1] || '',
        channelName: channelNameTag?.[1] || 'Unknown Channel',
        timestamp: event.created_at,
        event,
      };
    });

    // Sort by timestamp descending
    requests.sort((a, b) => b.timestamp - a.timestamp);

    adminStore.setPendingRequests(requests);
  } catch (error) {
    console.error('Failed to fetch pending requests:', error);
    adminStore.setError('Failed to load pending requests');
    adminStore.setLoading('requests', false);
  }
}

/**
 * Fetch all users from relay
 */
export async function fetchAllUsers(relay: NDKRelay): Promise<void> {
  adminStore.setLoading('users', true);
  adminStore.setError(null);

  try {
    // Fetch user metadata (kind 0) and membership events (kind 9022)
    const [metadataEvents, membershipEvents] = await Promise.all([
      relay.querySync([{ kinds: [0], limit: 500 }]),
      relay.querySync([{ kinds: [9022], limit: 1000 }]),
    ]);

    // Build user map from metadata
    const userMap = new Map<string, User>();

    metadataEvents.forEach(event => {
      try {
        const metadata = JSON.parse(event.content);
        userMap.set(event.pubkey, {
          pubkey: event.pubkey,
          name: metadata.name || metadata.display_name,
          cohorts: [],
          channels: [],
          joinedAt: event.created_at,
          lastSeen: event.created_at,
        });
      } catch (e) {
        console.error('Failed to parse metadata:', e);
      }
    });

    // Add membership data
    membershipEvents.forEach(event => {
      const user = userMap.get(event.pubkey);
      if (user) {
        const channelTag = event.tags.find(t => t[0] === 'e');
        const cohortTag = event.tags.find(t => t[0] === 'cohort');

        if (channelTag?.[1]) {
          user.channels.push(channelTag[1]);
        }
        if (cohortTag?.[1] && !user.cohorts.includes(cohortTag[1])) {
          user.cohorts.push(cohortTag[1]);
        }
        user.lastSeen = Math.max(user.lastSeen || 0, event.created_at);
      }
    });

    const users = Array.from(userMap.values());
    users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    adminStore.setUsers(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    adminStore.setError('Failed to load users');
    adminStore.setLoading('users', false);
  }
}

/**
 * Fetch all channels from relay
 */
export async function fetchAllChannels(relay: NDKRelay): Promise<void> {
  adminStore.setLoading('channels', true);
  adminStore.setError(null);

  try {
    // Fetch channel creation events (kind 40) and metadata (kind 41)
    const [creationEvents, metadataEvents, memberEvents] = await Promise.all([
      relay.querySync([{ kinds: [40], limit: 100 }]),
      relay.querySync([{ kinds: [41], limit: 100 }]),
      relay.querySync([{ kinds: [9022], limit: 1000 }]),
    ]);

    // Build channel map
    const channelMap = new Map<string, Channel>();

    creationEvents.forEach(event => {
      try {
        const metadata = JSON.parse(event.content);
        const cohortTag = event.tags.find(t => t[0] === 'cohort');
        const visibilityTag = event.tags.find(t => t[0] === 'visibility');
        const encryptedTag = event.tags.find(t => t[0] === 'encrypted');
        const sectionTag = event.tags.find(t => t[0] === 'section');

        channelMap.set(event.id, {
          id: event.id,
          name: metadata.name || 'Unnamed Channel',
          description: metadata.about || metadata.description,
          cohorts: cohortTag?.[1]?.split(',') || [],
          visibility: (visibilityTag?.[1] as any) || 'public',
          encrypted: encryptedTag?.[1] === 'true',
          section: (sectionTag?.[1] as ChannelSection) || 'fairfield-guests',
          createdAt: event.created_at,
          memberCount: 0,
          creatorPubkey: event.pubkey,
        });
      } catch (e) {
        console.error('Failed to parse channel creation event:', e);
      }
    });

    // Update with metadata events
    metadataEvents.forEach(event => {
      const channelIdTag = event.tags.find(t => t[0] === 'e');
      if (channelIdTag?.[1]) {
        const channel = channelMap.get(channelIdTag[1]);
        if (channel) {
          try {
            const metadata = JSON.parse(event.content);
            channel.name = metadata.name || channel.name;
            channel.description = metadata.about || metadata.description || channel.description;
          } catch (e) {
            console.error('Failed to parse channel metadata:', e);
          }
        }
      }
    });

    // Count members
    const memberCounts = new Map<string, Set<string>>();
    memberEvents.forEach(event => {
      const channelTag = event.tags.find(t => t[0] === 'e');
      if (channelTag?.[1]) {
        const members = memberCounts.get(channelTag[1]) || new Set();
        members.add(event.pubkey);
        memberCounts.set(channelTag[1], members);
      }
    });

    memberCounts.forEach((members, channelId) => {
      const channel = channelMap.get(channelId);
      if (channel) {
        channel.memberCount = members.size;
      }
    });

    const channels = Array.from(channelMap.values());
    channels.sort((a, b) => b.createdAt - a.createdAt);

    adminStore.setChannels(channels);
  } catch (error) {
    console.error('Failed to fetch channels:', error);
    adminStore.setError('Failed to load channels');
    adminStore.setLoading('channels', false);
  }
}
