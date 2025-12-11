import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchChannels, fetchChannelMessages } from '$lib/stores/ndk';

export const load: PageLoad = async ({ params }) => {
  if (!browser) {
    return { channel: null, messages: [] };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    throw redirect(302, '/');
  }

  try {
    const ndk = ndkStore.get();
    if (!ndk) {
      return { channel: null, messages: [] };
    }

    const channels = await fetchChannels(ndk);
    const channel = channels.find(c => c.id === params.channelId);

    if (!channel) {
      throw redirect(302, '/chat');
    }

    const messages = await fetchChannelMessages(ndk, params.channelId);

    return { channel, messages };
  } catch (error) {
    console.error('Failed to load channel:', error);
    throw redirect(302, '/chat');
  }
};
