<script lang="ts">
  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let closeOnBackdrop = true;
  export let closeOnEscape = true;

  $: sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-5xl'
  };

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      open = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (closeOnEscape && event.key === 'Escape' && open) {
      event.preventDefault();
      open = false;
    }
  }

  $: if (typeof window !== 'undefined') {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="modal modal-open"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
  >
    <div class="modal-box {sizeClasses[size]} relative">
      {#if title}
        <h3 id="modal-title" class="font-bold text-lg mb-4">{title}</h3>
      {/if}

      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        on:click={() => (open = false)}
        aria-label="Close"
      >
        ✕
      </button>

      <div class="modal-content">
        <slot />
      </div>

      {#if $$slots.actions}
        <div class="modal-action">
          <slot name="actions" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal {
    @apply backdrop-blur-sm;
  }

  .modal-box {
    @apply animate-fade-in;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
