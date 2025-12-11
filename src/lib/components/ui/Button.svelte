<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let loading = false;
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';

  $: variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-error'
  };

  $: sizeClasses = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  };

  $: classes = `btn ${variantClasses[variant]} ${sizeClasses[size]} ${loading ? 'loading' : ''}`;
</script>

<button
  {type}
  class={classes}
  disabled={disabled || loading}
  on:click
  {...$$restProps}
>
  {#if loading}
    <span class="loading loading-spinner"></span>
  {/if}
  <slot />
</button>

<style>
  button {
    @apply transition-all duration-200;
  }

  button:not(:disabled):hover {
    @apply transform scale-105;
  }

  button:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
</style>
