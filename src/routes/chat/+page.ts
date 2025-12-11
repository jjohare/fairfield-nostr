import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchChannels } from '$lib/stores/ndk';

export const load: PageLoad = async () => {
  if (!browser) {
    return { channels: [] };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    throw redirect(302, '/');
  }

  try {
    const ndk = ndkStore.get();
    if (!ndk) {
      return { channels: [] };
    }

    const channels = await fetchChannels(ndk);
    return { channels };
  } catch (error) {
    console.error('Failed to load channels:', error);
    return { channels: [] };
  }
};
