import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import type { Channel, Message, JoinRequest, MemberStatus } from '$lib/types/channel';

interface ChannelState {
  channels: Channel[];
  messages: Record<string, Message[]>;
  selectedChannelId: string | null;
  joinRequests: JoinRequest[];
  isLoading: boolean;
}

const initialState: ChannelState = {
  channels: [],
  messages: {},
  selectedChannelId: null,
  joinRequests: [],
  isLoading: false
};

// Create the base writable store
const store: Writable<ChannelState> = writable<ChannelState>(initialState);

// Helper to get current state
function getState(): ChannelState {
  return get(store);
}

// Export the channel store with methods
export const channelStore = {
  subscribe: store.subscribe,

  setChannels: (channels: Channel[]) => {
    store.update(state => ({ ...state, channels }));
  },

  addChannel: (channel: Channel) => {
    store.update(state => ({
      ...state,
      channels: [...state.channels, channel]
    }));
  },

  selectChannel: (channelId: string | null) => {
    store.update(state => ({ ...state, selectedChannelId: channelId }));
  },

  setMessages: (channelId: string, messages: Message[]) => {
    store.update(state => ({
      ...state,
      messages: {
        ...state.messages,
        [channelId]: messages
      }
    }));
  },

  addMessage: (message: Message) => {
    store.update(state => {
      const channelMessages = state.messages[message.channelId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [message.channelId]: [...channelMessages, message]
        }
      };
    });
  },

  deleteMessage: (channelId: string, messageId: string) => {
    store.update(state => ({
      ...state,
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).filter(m => m.id !== messageId)
      }
    }));
  },

  requestJoin: (channelId: string, requesterPubkey: string) => {
    const request: JoinRequest = {
      channelId,
      requesterPubkey,
      status: 'pending',
      createdAt: Date.now()
    };
    store.update(state => ({
      ...state,
      joinRequests: [...state.joinRequests, request]
    }));
  },

  getMemberStatus: (channelId: string, userPubkey: string | null): MemberStatus => {
    if (!userPubkey) return 'non-member';

    const state = getState();
    const channel = state.channels.find(c => c.id === channelId);

    if (!channel) return 'non-member';
    if (channel.admins.includes(userPubkey)) return 'admin';
    if (channel.members.includes(userPubkey)) return 'member';
    if (channel.pendingRequests.includes(userPubkey)) return 'pending';

    return 'non-member';
  },

  setLoading: (isLoading: boolean) => {
    store.update(state => ({ ...state, isLoading }));
  }
};

// Lazy-initialized derived stores to avoid circular dependency issues
let _selectedChannel: Readable<Channel | null> | null = null;
let _selectedMessages: Readable<Message[]> | null = null;
let _userMemberStatus: Readable<MemberStatus> | null = null;

export function getSelectedChannel(): Readable<Channel | null> {
  if (!_selectedChannel) {
    _selectedChannel = derived(store, $state =>
      $state.channels.find(c => c.id === $state.selectedChannelId) || null
    );
  }
  return _selectedChannel;
}

export function getSelectedMessages(): Readable<Message[]> {
  if (!_selectedMessages) {
    _selectedMessages = derived(store, $state => {
      if (!$state.selectedChannelId) return [];
      return $state.messages[$state.selectedChannelId] || [];
    });
  }
  return _selectedMessages;
}

export function getUserMemberStatus(): Readable<MemberStatus> {
  if (!_userMemberStatus) {
    // Import authStore dynamically to avoid circular dependency
    import('./auth').then(({ authStore }) => {
      const selChan = getSelectedChannel();
      _userMemberStatus = derived(
        [selChan, authStore],
        ([$selectedChannel, $authStore]) => {
          if (!$selectedChannel || !$authStore.publicKey) return 'non-member' as MemberStatus;

          const userPubkey = $authStore.publicKey;
          if ($selectedChannel.admins.includes(userPubkey)) return 'admin' as MemberStatus;
          if ($selectedChannel.members.includes(userPubkey)) return 'member' as MemberStatus;
          if ($selectedChannel.pendingRequests.includes(userPubkey)) return 'pending' as MemberStatus;

          return 'non-member' as MemberStatus;
        }
      );
    });
    // Return a temporary store while async import resolves
    return writable<MemberStatus>('non-member');
  }
  return _userMemberStatus;
}

// Backwards compatible exports using getters
export const selectedChannel = {
  subscribe: (fn: (value: Channel | null) => void) => getSelectedChannel().subscribe(fn)
};

export const selectedMessages = {
  subscribe: (fn: (value: Message[]) => void) => getSelectedMessages().subscribe(fn)
};

export const userMemberStatus = {
  subscribe: (fn: (value: MemberStatus) => void) => getUserMemberStatus().subscribe(fn)
};
