<script lang="ts">
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let text = '';
  export let variant: 'spinner' | 'dots' | 'ring' = 'spinner';

  $: sizeClasses = {
    xs: 'loading-xs',
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg'
  };

  $: variantClasses = {
    spinner: 'loading-spinner',
    dots: 'loading-dots',
    ring: 'loading-ring'
  };
</script>

<div class="flex flex-col items-center justify-center gap-2">
  <span class="loading {variantClasses[variant]} {sizeClasses[size]}"></span>
  {#if text}
    <p class="text-sm text-base-content/70">{text}</p>
  {/if}
</div>

<style>
  div {
    @apply animate-pulse;
  }
</style>
