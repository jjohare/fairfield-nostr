<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  const dispatch = createEventDispatcher();
  const READ_KEY = 'minimoomaa_read_posts';

  let isMarking = false;
  let justMarked = false;

  function markAllAsRead() {
    if (!browser) return;

    isMarking = true;

    // Store current timestamp as "last read" time
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(READ_KEY, now.toString());

    // Show feedback
    setTimeout(() => {
      isMarking = false;
      justMarked = true;
      dispatch('marked');

      // Reset after 2 seconds
      setTimeout(() => {
        justMarked = false;
      }, 2000);
    }, 500);
  }

  export function getLastReadTime(): number {
    if (!browser) return 0;
    const stored = localStorage.getItem(READ_KEY);
    return stored ? parseInt(stored) : 0;
  }

  export function isPostRead(timestamp: number): boolean {
    return timestamp <= getLastReadTime();
  }
</script>

<button
  class="btn btn-sm {justMarked ? 'btn-success' : 'btn-ghost'} gap-2"
  on:click={markAllAsRead}
  disabled={isMarking}
>
  {#if isMarking}
    <span class="loading loading-spinner loading-xs"></span>
  {:else if justMarked}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    Marked!
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    Mark All as Read
  {/if}
</button>
