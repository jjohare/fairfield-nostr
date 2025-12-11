import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';

const ADMIN_PUBKEYS = [
  // Add admin pubkeys here
  'npub1admin...'
];

export const load: PageLoad = async () => {
  if (!browser) {
    return { stats: null };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    throw redirect(302, '/');
  }

  try {
    const auth = JSON.parse(stored);

    if (!ADMIN_PUBKEYS.includes(auth.npub)) {
      throw redirect(302, '/chat');
    }

    // Fetch admin stats
    const stats = {
      totalUsers: 0,
      totalChannels: 0,
      totalMessages: 0,
      pendingApprovals: 0
    };

    return { stats };
  } catch (error) {
    console.error('Admin access denied:', error);
    throw redirect(302, '/chat');
  }
};
