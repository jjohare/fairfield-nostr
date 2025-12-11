import { writable, derived, get } from 'svelte/store';
import type { Channel, Message, JoinRequest, MemberStatus } from '$lib/types/channel';
import { authStore } from './authStore';

interface ChannelState {
  channels: Channel[];
  messages: Record<string, Message[]>;
  selectedChannelId: string | null;
  joinRequests: JoinRequest[];
  isLoading: boolean;
}

function createChannelStore() {
  const { subscribe, set, update } = writable<ChannelState>({
    channels: [],
    messages: {},
    selectedChannelId: null,
    joinRequests: [],
    isLoading: false
  });

  return {
    subscribe,

    setChannels: (channels: Channel[]) => {
      update(state => ({ ...state, channels }));
    },

    addChannel: (channel: Channel) => {
      update(state => ({
        ...state,
        channels: [...state.channels, channel]
      }));
    },

    selectChannel: (channelId: string | null) => {
      update(state => ({ ...state, selectedChannelId: channelId }));
    },

    setMessages: (channelId: string, messages: Message[]) => {
      update(state => ({
        ...state,
        messages: {
          ...state.messages,
          [channelId]: messages
        }
      }));
    },

    addMessage: (message: Message) => {
      update(state => {
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
      update(state => ({
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
      update(state => ({
        ...state,
        joinRequests: [...state.joinRequests, request]
      }));
    },

    getMemberStatus: (channelId: string, userPubkey: string | null): MemberStatus => {
      if (!userPubkey) return 'non-member';

      const state = get({ subscribe });
      const channel = state.channels.find(c => c.id === channelId);

      if (!channel) return 'non-member';
      if (channel.admins.includes(userPubkey)) return 'admin';
      if (channel.members.includes(userPubkey)) return 'member';
      if (channel.pendingRequests.includes(userPubkey)) return 'pending';

      return 'non-member';
    },

    setLoading: (isLoading: boolean) => {
      update(state => ({ ...state, isLoading }));
    }
  };
}

export const channelStore = createChannelStore();

export const selectedChannel = derived(
  channelStore,
  $channelStore => $channelStore.channels.find(c => c.id === $channelStore.selectedChannelId) || null
);

export const selectedMessages = derived(
  channelStore,
  $channelStore => {
    if (!$channelStore.selectedChannelId) return [];
    return $channelStore.messages[$channelStore.selectedChannelId] || [];
  }
);

export const userMemberStatus = derived(
  [channelStore, selectedChannel, authStore],
  ([$channelStore, $selectedChannel, $authStore]) => {
    if (!$selectedChannel || !$authStore.user) return 'non-member';
    return channelStore.getMemberStatus($selectedChannel.id, $authStore.user.pubkey);
  }
);
