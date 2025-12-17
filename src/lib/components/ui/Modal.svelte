<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let closeOnBackdrop = true;
  export let closeOnEscape = true;

  let previousActiveElement: HTMLElement | null = null;
  let modalElement: HTMLDivElement | null = null;
  let focusableElements: HTMLElement[] = [];
  let previousBodyOverflow = '';

  $: sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-5xl'
  };

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      closeModal();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    if (closeOnEscape && event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    // Focus trap: Tab and Shift+Tab
    if (event.key === 'Tab' && focusableElements.length > 0) {
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  function updateFocusableElements() {
    if (!modalElement) return;

    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusableElements = Array.from(modalElement.querySelectorAll(selector));
  }

  function closeModal() {
    open = false;
    // Restore focus to the element that triggered the modal
    if (previousActiveElement) {
      previousActiveElement.focus();
    }
  }

  $: if (typeof window !== 'undefined') {
    if (open) {
      // Store the currently focused element
      previousActiveElement = document.activeElement as HTMLElement;
      // Preserve previous body overflow state
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus the modal after a tick to ensure it's rendered
      setTimeout(() => {
        updateFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else if (modalElement) {
          modalElement.focus();
        }
      }, 50);
    } else {
      // Restore previous body overflow state
      document.body.style.overflow = previousBodyOverflow;
    }
  }

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      document.body.style.overflow = previousBodyOverflow;
    }
  });
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
    <div
      class="modal-box {sizeClasses[size]} relative"
      bind:this={modalElement}
      tabindex="-1"
    >
      {#if title}
        <h3 id="modal-title" class="font-bold text-lg mb-4">{title}</h3>
      {/if}

      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 focus-ring"
        on:click={closeModal}
        aria-label="Close modal"
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

  .modal-box:focus {
    outline: none;
  }

  .focus-ring:focus-visible {
    outline: 3px solid #fbbf24;
    outline-offset: 2px;
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
