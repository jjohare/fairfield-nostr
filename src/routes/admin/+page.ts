import type { PageLoad } from './$types';
import { browser } from '$app/environment';

const ADMIN_PUBKEYS = [
  // Add admin pubkeys here
  'npub1admin...'
];

// Allow prerendering
export const prerender = true;

export const load: PageLoad = async () => {
  if (!browser) {
    return { stats: null };
  }

  const stored = localStorage.getItem('fairfield_auth');
  if (!stored) {
    // Auth check handled in component
    return { stats: null };
  }

  try {
    const auth = JSON.parse(stored);

    if (!ADMIN_PUBKEYS.includes(auth.npub)) {
      // Permission check handled in component
      return { stats: null, isAdmin: false };
    }

    // Fetch admin stats
    const stats = {
      totalUsers: 0,
      totalChannels: 0,
      totalMessages: 0,
      pendingApprovals: 0
    };

    return { stats, isAdmin: true };
  } catch (error) {
    console.error('Admin access denied:', error);
    return { stats: null, isAdmin: false };
  }
};
