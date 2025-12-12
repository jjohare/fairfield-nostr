import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchChannels, fetchChannelMessages } from '$lib/stores/ndk';

// Dynamic routes can't be prerendered
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  if (!browser) {
    return { channel: null, messages: [] };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    // Auth check handled in component
    return { channel: null, messages: [] };
  }

  try {
    const ndk = ndkStore.get();
    if (!ndk) {
      return { channel: null, messages: [] };
    }

    const channels = await fetchChannels(ndk);
    const channel = channels.find(c => c.id === params.channelId);

    if (!channel) {
      return { channel: null, messages: [] };
    }

    const messages = await fetchChannelMessages(ndk, params.channelId);

    return { channel, messages };
  } catch (error) {
    console.error('Failed to load channel:', error);
    return { channel: null, messages: [] };
  }
};
