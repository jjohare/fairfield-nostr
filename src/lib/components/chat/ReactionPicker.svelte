<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { CommonReactions } from '$lib/nostr/reactions';

  export let show: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { emoji: string };
    close: void;
  }>();

  // Common reactions grid
  const commonReactions = [
    { emoji: CommonReactions.LIKE, label: 'Like' },
    { emoji: CommonReactions.LOVE, label: 'Love' },
    { emoji: CommonReactions.LAUGH, label: 'Laugh' },
    { emoji: CommonReactions.SURPRISED, label: 'Surprised' },
    { emoji: CommonReactions.SAD, label: 'Sad' },
    { emoji: CommonReactions.FIRE, label: 'Fire' },
    { emoji: CommonReactions.PARTY, label: 'Party' },
    { emoji: CommonReactions.THUMBS_UP, label: 'Thumbs Up' },
  ];

  function handleSelect(emoji: string) {
    dispatch('select', { emoji });
    show = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.reaction-picker')) {
      dispatch('close');
      show = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
      show = false;
    }
  }
</script>

{#if show}
  <div
    class="reaction-picker absolute bottom-full left-0 mb-2 z-50"
    role="dialog"
    aria-label="Reaction picker"
  >
    <div class="bg-base-100 rounded-lg shadow-lg border border-base-300 p-2">
      <div class="grid grid-cols-4 gap-1">
        {#each commonReactions as { emoji, label }}
          <button
            class="btn btn-ghost btn-sm hover:btn-primary aspect-square p-2 flex items-center justify-center"
            on:click={() => handleSelect(emoji)}
            title={label}
            aria-label={label}
          >
            <span class="text-2xl leading-none">
              {emoji}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Backdrop for mobile -->
  <div
    class="fixed inset-0 z-40 lg:hidden"
    on:click={handleClickOutside}
    on:keydown={handleKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close reaction picker"
  />
{/if}

<style>
  .reaction-picker {
    min-width: 16rem;
  }

  button {
    min-height: 3rem;
    height: 3rem;
  }

  @media (max-width: 1024px) {
    .reaction-picker {
      position: fixed;
      bottom: 4rem;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0;
    }
  }
</style>
