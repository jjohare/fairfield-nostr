<script lang="ts">
  export let src: string | undefined = undefined;
  export let pubkey: string | undefined = undefined;
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let alt = 'Avatar';

  let imageError = false;

  $: sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  $: gradientColor = pubkey ? generateGradientFromPubkey(pubkey) : 'from-gray-400 to-gray-600';
  $: robohashUrl = pubkey ? `https://robohash.org/${pubkey}?set=set4` : undefined;
  $: displaySrc = !imageError && src ? src : robohashUrl;

  function generateGradientFromPubkey(pk: string): string {
    const hash = pk.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    const hue1 = Math.abs(hash % 360);
    const hue2 = Math.abs((hash * 2) % 360);

    return `from-[hsl(${hue1},70%,60%)] to-[hsl(${hue2},70%,60%)]`;
  }

  function handleImageError() {
    imageError = true;
  }

  $: initials = alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
</script>

<div class="avatar">
  <div class="rounded-full {sizeClasses[size]}">
    {#if displaySrc}
      <img
        src={displaySrc}
        {alt}
        on:error={handleImageError}
        class="object-cover w-full h-full"
      />
    {:else}
      <div
        class="w-full h-full flex items-center justify-center bg-gradient-to-br {gradientColor} text-white font-semibold"
        class:text-xs={size === 'xs'}
        class:text-sm={size === 'sm'}
        class:text-base={size === 'md'}
        class:text-lg={size === 'lg'}
      >
        {initials}
      </div>
    {/if}
  </div>
</div>

<style>
  .avatar {
    @apply inline-flex;
  }

  img {
    @apply transition-opacity duration-200;
  }

  img:hover {
    @apply opacity-90;
  }
</style>
