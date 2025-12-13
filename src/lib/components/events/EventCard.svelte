<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { rsvpToEvent, type CalendarEvent } from '$lib/nostr/calendar';
  import { authStore } from '$lib/stores/auth';

  export let event: CalendarEvent;
  export let showChannel = false;
  export let compact = false;

  const dispatch = createEventDispatcher();

  let isRsvping = false;
  let userRsvp: 'accept' | 'decline' | 'tentative' | null = null;

  function handleJoinChat(e: MouseEvent) {
    e.stopPropagation();
    if (event.chatRoomId) {
      goto(`${base}/chat/${event.chatRoomId}`);
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getTimeUntil(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;

    if (diff < 0) return 'Past';
    if (diff < 3600) return `In ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `In ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `In ${Math.floor(diff / 86400)}d`;
    return formatDate(timestamp);
  }

  function isUpcoming(timestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return timestamp > now;
  }

  function isHappeningNow(start: number, end: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= start && now <= end;
  }

  async function handleRsvp(status: 'accept' | 'decline' | 'tentative') {
    if (isRsvping || !$authStore.isAuthenticated) return;

    isRsvping = true;
    try {
      const success = await rsvpToEvent(event.id, status);
      if (success) {
        userRsvp = status;
        dispatch('rsvp', { eventId: event.id, status });
      }
    } catch (e) {
      console.error('RSVP failed:', e);
    } finally {
      isRsvping = false;
    }
  }

  function handleClick() {
    dispatch('click', event);
  }
</script>

<button
  class="card bg-base-200 hover:bg-base-300 transition-all text-left w-full border border-transparent hover:border-primary/30"
  class:opacity-60={!isUpcoming(event.start) && !isHappeningNow(event.start, event.end)}
  on:click={handleClick}
>
  <div class="card-body p-4" class:py-2={compact}>
    <div class="flex gap-4">
      <!-- Date Box -->
      <div
        class="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-lg"
        class:bg-primary={isUpcoming(event.start)}
        class:text-primary-content={isUpcoming(event.start)}
        class:bg-success={isHappeningNow(event.start, event.end)}
        class:text-success-content={isHappeningNow(event.start, event.end)}
        class:bg-base-300={!isUpcoming(event.start) && !isHappeningNow(event.start, event.end)}
      >
        <span class="text-xs font-medium uppercase">
          {new Date(event.start * 1000).toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span class="text-xl font-bold leading-none">
          {new Date(event.start * 1000).getDate()}
        </span>
      </div>

      <!-- Event Details -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-base truncate">{event.title}</h4>
            <div class="flex items-center gap-2 text-sm text-base-content/70 mt-0.5">
              <span>{formatTime(event.start)}</span>
              {#if event.end && event.end !== event.start}
                <span>- {formatTime(event.end)}</span>
              {/if}
            </div>
          </div>

          <!-- Time Badge -->
          <div class="flex-shrink-0">
            {#if isHappeningNow(event.start, event.end)}
              <span class="badge badge-success badge-sm animate-pulse">LIVE</span>
            {:else if isUpcoming(event.start)}
              <span class="badge badge-primary badge-sm">{getTimeUntil(event.start)}</span>
            {:else}
              <span class="badge badge-ghost badge-sm">Past</span>
            {/if}
          </div>
        </div>

        {#if !compact}
          {#if event.description}
            <p class="text-sm text-base-content/60 line-clamp-2 mt-1">
              {event.description}
            </p>
          {/if}

          <div class="flex flex-wrap items-center gap-2 mt-2">
            {#if event.location}
              <span class="badge badge-outline badge-sm gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {event.location}
              </span>
            {/if}

            {#if showChannel && event.channelId}
              <span class="badge badge-secondary badge-sm">{event.channelId.slice(0, 8)}...</span>
            {/if}

            {#if event.maxAttendees}
              <span class="badge badge-outline badge-sm">
                Max: {event.maxAttendees}
              </span>
            {/if}

            {#if event.chatRoomId}
              <button
                class="btn btn-xs btn-primary gap-1"
                on:click={handleJoinChat}
                title="Join event chatroom"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Chat
              </button>
            {/if}
          </div>
        {/if}

        <!-- RSVP Buttons (only for upcoming events) -->
        {#if isUpcoming(event.start) && $authStore.isAuthenticated && !compact}
          <div class="flex items-center gap-2 mt-3">
            <span class="text-xs text-base-content/50">RSVP:</span>
            <button
              class="btn btn-xs"
              class:btn-success={userRsvp === 'accept'}
              class:btn-outline={userRsvp !== 'accept'}
              on:click|stopPropagation={() => handleRsvp('accept')}
              disabled={isRsvping}
            >
              Going
            </button>
            <button
              class="btn btn-xs"
              class:btn-warning={userRsvp === 'tentative'}
              class:btn-outline={userRsvp !== 'tentative'}
              on:click|stopPropagation={() => handleRsvp('tentative')}
              disabled={isRsvping}
            >
              Maybe
            </button>
            <button
              class="btn btn-xs"
              class:btn-error={userRsvp === 'decline'}
              class:btn-outline={userRsvp !== 'decline'}
              on:click|stopPropagation={() => handleRsvp('decline')}
              disabled={isRsvping}
            >
              Can't Go
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</button>
