import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { ndkStore, fetchDirectMessages } from '$lib/stores/ndk';

export const load: PageLoad = async () => {
  if (!browser) {
    return { conversations: [] };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    throw redirect(302, '/');
  }

  try {
    const auth = JSON.parse(stored);
    const ndk = ndkStore.get();

    if (!ndk || !auth.npub) {
      return { conversations: [] };
    }

    const messages = await fetchDirectMessages(ndk, auth.npub);

    // Group by conversation partner
    const conversationsMap = new Map<string, any>();

    messages.forEach(msg => {
      const partner = msg.pubkey === auth.npub ? msg.recipient : msg.pubkey;

      if (!conversationsMap.has(partner)) {
        conversationsMap.set(partner, {
          pubkey: partner,
          lastMessage: msg,
          unread: 0
        });
      } else {
        const conv = conversationsMap.get(partner);
        if (msg.created_at > conv.lastMessage.created_at) {
          conv.lastMessage = msg;
        }
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => b.lastMessage.created_at - a.lastMessage.created_at);

    return { conversations };
  } catch (error) {
    console.error('Failed to load DMs:', error);
    return { conversations: [] };
  }
};
