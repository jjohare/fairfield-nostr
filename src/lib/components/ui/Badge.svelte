<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral' = 'neutral';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let outline = false;

  $: variantClasses = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'badge-success',
    error: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
    neutral: 'badge-neutral'
  };

  $: sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg'
  };

  $: classes = `badge ${variantClasses[variant]} ${sizeClasses[size]} ${outline ? 'badge-outline' : ''}`;
</script>

<span class={classes} {...$$restProps}>
  <slot />
</span>

<style>
  .badge {
    @apply inline-flex items-center gap-1 transition-all duration-200;
  }

  .badge:not(.badge-outline) {
    @apply font-semibold;
  }

  .badge-outline {
    @apply border-2;
  }
</style>
