<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { fetchUpcomingEvents, type CalendarEvent } from '$lib/nostr/calendar';
  import { browser } from '$app/environment';

  export let channelId: string | null = null;
  export let limit = 5;
  export let showAll = false;

  let events: CalendarEvent[] = [];
  let loading = true;

  onMount(async () => {
    if (!browser) return;

    try {
      const upcoming = await fetchUpcomingEvents(30);

      // Filter by channel if specified
      if (channelId) {
        events = upcoming.filter((e) => e.channelId === channelId).slice(0, limit);
      } else {
        events = upcoming.slice(0, limit);
      }
    } catch (e) {
      console.error('Failed to fetch upcoming events:', e);
    } finally {
      loading = false;
    }
  });

  function formatEventTime(start: number, end: number): string {
    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);

    const dateStr = startDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const timeStr = startDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${dateStr} at ${timeStr}`;
  }

  function goToEvents() {
    if (channelId) {
      goto(`${base}/events?channel=${channelId}`);
    } else {
      goto(`${base}/events`);
    }
  }

  function goToEvent(event: CalendarEvent) {
    goto(`${base}/events/${event.id}`);
  }
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="card-title text-lg text-primary">Upcoming Events</h3>
      {#if showAll}
        <button class="btn btn-xs btn-ghost" on:click={goToEvents}> View All </button>
      {/if}
    </div>

    {#if loading}
      <div class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
    {:else if events.length === 0}
      <p class="text-base-content/60 text-sm text-center py-2">No upcoming events</p>
    {:else}
      <div class="space-y-3">
        {#each events as event}
          <button
            class="w-full text-left hover:bg-base-300 rounded-lg p-2 -mx-2 transition-colors"
            on:click={() => goToEvent(event)}
          >
            <div class="flex items-start gap-3">
              <!-- Date indicator -->
              <div
                class="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded bg-primary/20 text-primary"
              >
                <span class="text-[10px] font-medium uppercase leading-none">
                  {new Date(event.start * 1000).toLocaleDateString(undefined, { month: 'short' })}
                </span>
                <span class="text-lg font-bold leading-none">
                  {new Date(event.start * 1000).getDate()}
                </span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">{event.title}</div>
                <div class="text-xs text-base-content/60">
                  {new Date(event.start * 1000).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {#if event.location}
                  <div class="text-xs text-base-content/40 truncate">{event.location}</div>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
