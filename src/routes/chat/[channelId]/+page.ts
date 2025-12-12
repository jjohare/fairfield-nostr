import type { PageLoad } from './$types';

// Dynamic routes can't be prerendered
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  // Data loading happens in component to avoid SSR issues
  return { channelId: params.channelId, channel: null, messages: [] };
};
