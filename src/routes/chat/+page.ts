import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchChannels } from '$lib/stores/ndk';

// Allow prerendering
export const prerender = true;

export const load: PageLoad = async () => {
  if (!browser) {
    return { channels: [] };
  }

  // Auth check is handled in the component with goto()
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
