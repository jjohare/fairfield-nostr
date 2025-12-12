import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchDirectMessages } from '$lib/stores/ndk';

// Dynamic routes can't be prerendered
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  if (!browser) {
    return { messages: [], recipientPubkey: params.pubkey };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    // Auth check handled in component
    return { messages: [], recipientPubkey: params.pubkey };
  }

  try {
    const auth = JSON.parse(stored);
    const ndk = ndkStore.get();

    if (!ndk || !auth.npub) {
      return { messages: [], recipientPubkey: params.pubkey };
    }

    const messages = await fetchDirectMessages(ndk, auth.npub, params.pubkey);

    return {
      messages,
      recipientPubkey: params.pubkey,
      currentUserPubkey: auth.npub
    };
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return { messages: [], recipientPubkey: params.pubkey };
  }
};
