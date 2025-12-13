<script lang="ts">
  import { onMount } from 'svelte';
  import { profileCache } from '$lib/stores/profiles';
  import { getAvatarUrl } from '$lib/utils/identicon';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { CachedProfile } from '$lib/stores/profiles';

  export let pubkey: string;
  export let showAvatar = true;
  export let avatarSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let showName = true;
  export let showFullName = false;
  export let clickable = false;
  export let maxNameLength: number | null = null;

  let profile: CachedProfile | null = null;
  let unsubscribe: (() => void) | null = null;

  $: displayName = profile?.displayName || truncatePubkey(pubkey);
  $: avatarUrl = profile?.avatar || getAvatarUrl(pubkey, avatarSizeMap[avatarSize]);
  $: truncatedName = maxNameLength && displayName.length > maxNameLength
    ? displayName.slice(0, maxNameLength) + '...'
    : displayName;

  const avatarSizeMap = {
    xs: 32,
    sm: 48,
    md: 64,
    lg: 80
  };

  onMount(() => {
    // Subscribe to profile cache
    unsubscribe = profileCache.subscribe($cache => {
      profile = $cache.profiles.get(pubkey) || null;
    });

    // Fetch profile if not cached
    profileCache.getProfile(pubkey);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });

  function truncatePubkey(pk: string): string {
    if (pk.length <= 16) return pk;
    return `${pk.slice(0, 8)}...${pk.slice(-4)}`;
  }

  function handleClick() {
    if (clickable) {
      // TODO: Open profile modal or navigate to profile page
      console.log('Profile clicked:', pubkey);
    }
  }
</script>

<div
  class="user-display inline-flex items-center gap-2"
  class:cursor-pointer={clickable}
  class:hover:opacity-80={clickable}
  on:click={handleClick}
  on:keydown={e => e.key === 'Enter' && clickable && handleClick()}
  role={clickable ? 'button' : 'presentation'}
  tabindex={clickable ? 0 : -1}
>
  {#if showAvatar}
    <Avatar
      src={avatarUrl}
      {pubkey}
      size={avatarSize}
      alt={displayName}
    />
  {/if}

  {#if showName}
    <span class="user-name" class:font-semibold={showFullName}>
      {truncatedName}
    </span>

    {#if profile?.nip05}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-success flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        title="Verified"
      >
        <path
          fill-rule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
      </svg>
    {/if}
  {/if}
</div>

<style>
  .user-display {
    transition: opacity 0.2s;
  }

  .user-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
