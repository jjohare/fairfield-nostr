import type { PageLoad } from './$types';
import { browser } from '$app/environment';

// Allow prerendering - data is loaded in component
export const prerender = true;

export const load: PageLoad = async () => {
  // All data loading happens in the component to avoid SSR/prerender issues
  return { channels: [] };
};
