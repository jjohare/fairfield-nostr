import { writable } from 'svelte/store';
import NDK, { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social'
];

function createNDKStore() {
  const { subscribe, set } = writable<NDK | null>(null);

  let instance: NDK | null = null;

  const init = async () => {
    if (!browser || instance) return instance;

    try {
      const ndk = new NDK({
        explicitRelayUrls: RELAYS,
        autoConnectUserRelays: true
      });

      await ndk.connect();
      instance = ndk;
      set(ndk);

      console.log('NDK connected to relays');
      return ndk;
    } catch (error) {
      console.error('Failed to initialize NDK:', error);
      return null;
    }
  };

  return {
    subscribe,
    init,
    get: () => instance
  };
}

export const ndkStore = createNDKStore();

export interface Channel {
  id: string;
  name: string;
  about: string;
  picture?: string;
  creator: string;
  created_at: number;
}

export interface ChannelMessage {
  id: string;
  content: string;
  pubkey: string;
  created_at: number;
  channel_id: string;
}

export interface DirectMessage {
  id: string;
  content: string;
  pubkey: string;
  recipient: string;
  created_at: number;
  decrypted?: string;
}

export async function fetchChannels(ndk: NDK): Promise<Channel[]> {
  const filter: NDKFilter = {
    kinds: [40], // Channel creation events
    limit: 100
  };

  const events = await ndk.fetchEvents(filter);

  return Array.from(events).map(event => ({
    id: event.id,
    name: event.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Channel',
    about: event.tags.find(t => t[0] === 'about')?.[1] || '',
    picture: event.tags.find(t => t[0] === 'picture')?.[1],
    creator: event.pubkey,
    created_at: event.created_at || 0
  })).sort((a, b) => b.created_at - a.created_at);
}

export async function fetchChannelMessages(
  ndk: NDK,
  channelId: string,
  limit = 50
): Promise<ChannelMessage[]> {
  const filter: NDKFilter = {
    kinds: [42], // Channel message events
    '#e': [channelId],
    limit
  };

  const events = await ndk.fetchEvents(filter);

  return Array.from(events).map(event => ({
    id: event.id,
    content: event.content,
    pubkey: event.pubkey,
    created_at: event.created_at || 0,
    channel_id: channelId
  })).sort((a, b) => a.created_at - b.created_at);
}

export async function fetchDirectMessages(
  ndk: NDK,
  userPubkey: string,
  otherPubkey?: string
): Promise<DirectMessage[]> {
  const filters: NDKFilter[] = [
    {
      kinds: [4], // DM events
      authors: [userPubkey],
      limit: 100
    },
    {
      kinds: [4],
      '#p': [userPubkey],
      limit: 100
    }
  ];

  if (otherPubkey) {
    filters[0]['#p'] = [otherPubkey];
    filters[1].authors = [otherPubkey];
  }

  const events = await ndk.fetchEvents(filters[0]);
  const receivedEvents = await ndk.fetchEvents(filters[1]);

  const allEvents = [...Array.from(events), ...Array.from(receivedEvents)];

  return allEvents.map(event => ({
    id: event.id,
    content: event.content,
    pubkey: event.pubkey,
    recipient: event.tags.find(t => t[0] === 'p')?.[1] || '',
    created_at: event.created_at || 0
  })).sort((a, b) => a.created_at - b.created_at);
}

export async function publishChannelMessage(
  ndk: NDK,
  channelId: string,
  content: string,
  signer: import('@nostr-dev-kit/ndk').NDKSigner
): Promise<boolean> {
  try {
    const event = new NDKEvent(ndk);
    event.kind = 42;
    event.content = content;
    event.tags = [
      ['e', channelId, '', 'root']
    ];

    ndk.signer = signer;
    await event.publish();
    return true;
  } catch (error) {
    console.error('Failed to publish channel message:', error);
    return false;
  }
}

export async function publishDirectMessage(
  ndk: NDK,
  recipientPubkey: string,
  content: string,
  signer: import('@nostr-dev-kit/ndk').NDKSigner
): Promise<boolean> {
  try {
    const event = new NDKEvent(ndk);
    event.kind = 4;
    event.content = content; // Should be encrypted
    event.tags = [
      ['p', recipientPubkey]
    ];

    ndk.signer = signer;
    await event.publish();
    return true;
  } catch (error) {
    console.error('Failed to publish DM:', error);
    return false;
  }
}
