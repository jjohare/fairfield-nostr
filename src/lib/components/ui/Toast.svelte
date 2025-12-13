<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  $: toasts = $toast.toasts;

  $: variantClasses = {
    success: 'alert-success',
    error: 'alert-error',
    info: 'alert-info',
    warning: 'alert-warning'
  };

  $: variantIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  function handleDismiss(id: string) {
    toast.remove(id);
  }

  async function handleAction(id: string, callback: () => void | Promise<void>) {
    toast.remove(id);
    await callback();
  }
</script>

<div class="toast toast-end z-50">
  {#each toasts as toastItem (toastItem.id)}
    <div
      class="alert {variantClasses[toastItem.variant]} shadow-lg min-w-[300px] max-w-md"
      transition:fly={{ x: 300, duration: 300 }}
      animate:flip={{ duration: 300 }}
    >
      <div class="flex items-start gap-2 w-full">
        <span class="text-xl flex-shrink-0">
          {variantIcons[toastItem.variant]}
        </span>

        <div class="flex-1 flex flex-col gap-2">
          <span class="text-sm break-words">
            {toastItem.message}
          </span>

          {#if toastItem.action}
            <button
              class="btn btn-xs btn-outline self-start"
              on:click={() => handleAction(toastItem.id, toastItem.action.callback)}
            >
              {toastItem.action.label}
            </button>
          {/if}
        </div>

        {#if toastItem.dismissible}
          <button
            class="btn btn-ghost btn-xs btn-circle flex-shrink-0"
            on:click={() => handleDismiss(toastItem.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .toast {
    @apply fixed bottom-4 right-4 flex flex-col gap-2;
  }

  .alert {
    @apply animate-slide-in;
  }

  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }

  @media (max-width: 640px) {
    .toast {
      @apply left-4 right-4 bottom-4;
    }

    .alert {
      @apply min-w-0 w-full;
    }
  }
</style>
