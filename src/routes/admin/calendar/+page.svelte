<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { setSigner, connectNDK } from '$lib/nostr/ndk';
  import { fetchAllEvents, type CalendarEvent } from '$lib/nostr/calendar';
  import { fetchChannels, type CreatedChannel } from '$lib/nostr/channels';
  import EventCalendar from '$lib/components/events/EventCalendar.svelte';
  import EventCard from '$lib/components/events/EventCard.svelte';

  // Admin pubkey
  const ADMIN_PUBKEY = '55f6d852c8ecbf022be81be356b62fdeef09c900deaf2bd262dc6759427c2eb2';

  let events: CalendarEvent[] = [];
  let channels: CreatedChannel[] = [];
  let channelMap: Map<string, string> = new Map();
  let loading = true;
  let error: string | null = null;
  let currentDate = new Date();
  let selectedEvent: CalendarEvent | null = null;

  // Group events by channel
  $: eventsByChannel = events.reduce(
    (acc, event) => {
      const channelId = event.channelId || 'uncategorized';
      if (!acc[channelId]) {
        acc[channelId] = [];
      }
      acc[channelId].push(event);
      return acc;
    },
    {} as Record<string, CalendarEvent[]>
  );

  // Get upcoming events (next 7 days)
  $: upcomingEvents = events
    .filter((e) => {
      const now = Math.floor(Date.now() / 1000);
      const weekAhead = now + 7 * 24 * 60 * 60;
      return e.start >= now && e.start <= weekAhead;
    })
    .slice(0, 10);

  onMount(async () => {
    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    // Check admin access
    if ($authStore.publicKey !== ADMIN_PUBKEY) {
      goto(`${base}/events`);
      return;
    }

    try {
      if ($authStore.privateKey) {
        setSigner($authStore.privateKey);
      }

      await connectNDK();

      // Fetch channels and events in parallel
      const [channelResults, eventResults] = await Promise.all([fetchChannels(), fetchAllEvents()]);

      channels = channelResults;
      events = eventResults;

      // Build channel name map
      channels.forEach((c) => channelMap.set(c.id, c.name));
    } catch (e) {
      console.error('Failed to load calendar data:', e);
      error = e instanceof Error ? e.message : 'Failed to load calendar data';
    } finally {
      loading = false;
    }
  });

  function getChannelName(channelId: string): string {
    return channelMap.get(channelId) || channelId.slice(0, 8) + '...';
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleEventClick(event: CustomEvent<CalendarEvent>) {
    selectedEvent = event.detail;
  }

  function closeEventDetail() {
    selectedEvent = null;
  }

  function goBack() {
    goto(`${base}/admin`);
  }
</script>

<svelte:head>
  <title>Admin Calendar - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-7xl">
  <!-- Header -->
  <div class="mb-6">
    <button class="btn btn-ghost btn-sm gap-1 mb-4" on:click={goBack}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Admin
    </button>

    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold gradient-text mb-2">Admin Calendar</h1>
        <p class="text-base-content/70">Combined view of all channel events</p>
      </div>

      <div class="stats shadow bg-base-200">
        <div class="stat py-2 px-4">
          <div class="stat-title text-xs">Total Events</div>
          <div class="stat-value text-2xl text-primary">{events.length}</div>
        </div>
        <div class="stat py-2 px-4">
          <div class="stat-title text-xs">Channels</div>
          <div class="stat-value text-2xl text-secondary">{channels.length}</div>
        </div>
        <div class="stat py-2 px-4">
          <div class="stat-title text-xs">This Week</div>
          <div class="stat-value text-2xl text-accent">{upcomingEvents.length}</div>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Calendar -->
      <div class="xl:col-span-2">
        <EventCalendar {events} {currentDate} on:eventClick={handleEventClick} />
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- Upcoming Events -->
        <div class="card bg-base-200 shadow-lg">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-primary mb-3">Upcoming This Week</h3>
            {#if upcomingEvents.length === 0}
              <p class="text-base-content/60 text-sm text-center py-4">No upcoming events</p>
            {:else}
              <div class="space-y-2">
                {#each upcomingEvents as event}
                  <button
                    class="w-full text-left hover:bg-base-300 rounded-lg p-2 -mx-2 transition-colors"
                    on:click={() => (selectedEvent = event)}
                  >
                    <div class="flex items-start gap-2">
                      <div
                        class="flex-shrink-0 w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary text-xs font-bold"
                      >
                        {new Date(event.start * 1000).getDate()}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm truncate">{event.title}</div>
                        <div class="text-xs text-base-content/60">
                          {getChannelName(event.channelId)}
                        </div>
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Events by Channel -->
        <div class="card bg-base-200 shadow-lg">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-primary mb-3">Events by Channel</h3>
            <div class="space-y-3">
              {#each Object.entries(eventsByChannel) as [channelId, channelEvents]}
                <div class="flex items-center justify-between text-sm">
                  <span class="truncate flex-1">{getChannelName(channelId)}</span>
                  <span class="badge badge-primary badge-sm">{channelEvents.length}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="card bg-base-200 shadow-lg">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-primary mb-3">Quick Actions</h3>
            <div class="space-y-2">
              <a href="{base}/events" class="btn btn-sm btn-block btn-ghost justify-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Public Events Page
              </a>
              <a href="{base}/admin" class="btn btn-sm btn-block btn-ghost justify-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Admin Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Event Detail Modal -->
{#if selectedEvent}
  <div class="modal modal-open">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-xl mb-4">{selectedEvent.title}</h3>

      <div class="space-y-3">
        <div>
          <div class="text-sm text-base-content/60">Date & Time</div>
          <div class="font-medium">{formatDate(selectedEvent.start)}</div>
          {#if selectedEvent.end && selectedEvent.end !== selectedEvent.start}
            <div class="text-sm">to {formatDate(selectedEvent.end)}</div>
          {/if}
        </div>

        <div>
          <div class="text-sm text-base-content/60">Channel</div>
          <div class="font-medium">{getChannelName(selectedEvent.channelId)}</div>
        </div>

        {#if selectedEvent.location}
          <div>
            <div class="text-sm text-base-content/60">Location</div>
            <div class="font-medium">{selectedEvent.location}</div>
          </div>
        {/if}

        {#if selectedEvent.description}
          <div>
            <div class="text-sm text-base-content/60">Description</div>
            <div class="text-sm">{selectedEvent.description}</div>
          </div>
        {/if}

        {#if selectedEvent.maxAttendees}
          <div>
            <div class="text-sm text-base-content/60">Max Attendees</div>
            <div class="font-medium">{selectedEvent.maxAttendees}</div>
          </div>
        {/if}

        <div>
          <div class="text-sm text-base-content/60">Created By</div>
          <div class="font-mono text-xs">{selectedEvent.createdBy.slice(0, 16)}...</div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" on:click={closeEventDetail}>Close</button>
      </div>
    </div>
    <button class="modal-backdrop" on:click={closeEventDetail}>Close</button>
  </div>
{/if}
