<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { setSigner, connectNDK } from '$lib/nostr/ndk';
  import { fetchAllEvents, fetchChannelEvents, type CalendarEvent } from '$lib/nostr/calendar';
  import { fetchChannels, type CreatedChannel } from '$lib/nostr/channels';
  import EventCalendar from '$lib/components/events/EventCalendar.svelte';
  import EventCard from '$lib/components/events/EventCard.svelte';
  import CreateEventModal from '$lib/components/events/CreateEventModal.svelte';

  let events: CalendarEvent[] = [];
  let channels: CreatedChannel[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedChannelId: string | null = null;
  let showCreateModal = false;
  let currentDate = new Date();
  let viewMode: 'calendar' | 'list' = 'calendar';

  $: filteredEvents = selectedChannelId
    ? events.filter((e) => e.channelId === selectedChannelId)
    : events;

  $: selectedChannel = channels.find((c) => c.id === selectedChannelId);

  onMount(async () => {
    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    // Check URL for channel filter
    const urlChannel = $page.url.searchParams.get('channel');
    if (urlChannel) {
      selectedChannelId = urlChannel;
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
    } catch (e) {
      console.error('Failed to load events:', e);
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  });

  function handleEventClick(event: CustomEvent<CalendarEvent>) {
    // Could navigate to event detail page
    console.log('Event clicked:', event.detail);
  }

  function handleDayClick(event: CustomEvent<Date>) {
    // Could open create modal for that day
    console.log('Day clicked:', event.detail);
  }

  function handleEventCreated(event: CustomEvent<CalendarEvent>) {
    events = [...events, event.detail].sort((a, b) => a.start - b.start);
    showCreateModal = false;
  }

  function filterByChannel(channelId: string | null) {
    selectedChannelId = channelId;
    if (channelId) {
      goto(`${base}/events?channel=${channelId}`, { replaceState: true });
    } else {
      goto(`${base}/events`, { replaceState: true });
    }
  }
</script>

<svelte:head>
  <title>Events - Minimoomaa Noir</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold gradient-text mb-2">Events</h1>
        <p class="text-base-content/70">
          {#if selectedChannel}
            Events for {selectedChannel.name}
          {:else}
            All community events
          {/if}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- View Toggle -->
        <div class="btn-group">
          <button
            class="btn btn-sm"
            class:btn-active={viewMode === 'calendar'}
            on:click={() => (viewMode = 'calendar')}
          >
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
          </button>
          <button
            class="btn btn-sm"
            class:btn-active={viewMode === 'list'}
            on:click={() => (viewMode = 'list')}
          >
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        <!-- Create Event Button -->
        {#if selectedChannelId}
          <button class="btn btn-primary btn-sm" on:click={() => (showCreateModal = true)}>
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Event
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Sidebar - Channel Filter -->
    <div class="lg:w-64 space-y-4">
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body p-4">
          <h3 class="font-bold text-sm mb-3">Filter by Channel</h3>
          <div class="space-y-1">
            <button
              class="btn btn-sm btn-block justify-start"
              class:btn-primary={!selectedChannelId}
              class:btn-ghost={selectedChannelId}
              on:click={() => filterByChannel(null)}
            >
              All Events
            </button>
            {#each channels as channel}
              <button
                class="btn btn-sm btn-block justify-start truncate"
                class:btn-primary={selectedChannelId === channel.id}
                class:btn-ghost={selectedChannelId !== channel.id}
                on:click={() => filterByChannel(channel.id)}
              >
                {channel.name}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body p-4">
          <h3 class="font-bold text-sm mb-3">Event Stats</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-base-content/60">Total Events</span>
              <span class="font-medium">{events.length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-base-content/60">This Month</span>
              <span class="font-medium">{filteredEvents.length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-base-content/60">Upcoming</span>
              <span class="font-medium">
                {filteredEvents.filter((e) => e.start > Date.now() / 1000).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1">
      {#if loading}
        <div class="flex justify-center items-center min-h-[400px]">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      {:else if error}
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      {:else if viewMode === 'calendar'}
        <EventCalendar
          events={filteredEvents}
          {currentDate}
          on:eventClick={handleEventClick}
          on:dayClick={handleDayClick}
        />
      {:else}
        <div class="space-y-3">
          {#if filteredEvents.length === 0}
            <div class="card bg-base-200">
              <div class="card-body items-center text-center">
                <p class="text-base-content/70">No events found</p>
                {#if selectedChannelId}
                  <button class="btn btn-primary btn-sm mt-2" on:click={() => (showCreateModal = true)}>
                    Create the first event
                  </button>
                {/if}
              </div>
            </div>
          {:else}
            {#each filteredEvents as event (event.id)}
              <EventCard {event} showChannel={!selectedChannelId} on:click={handleEventClick} />
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Create Event Modal -->
{#if selectedChannelId && selectedChannel}
  <CreateEventModal
    channelId={selectedChannelId}
    channelName={selectedChannel.name}
    bind:isOpen={showCreateModal}
    on:created={handleEventCreated}
  />
{/if}
