<script lang="ts">
  import { onMount } from 'svelte';
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarStore } from '$lib/stores/calendar';
  import { authStore } from '$lib/stores/auth';
  import { userPermissionsStore } from '$lib/stores/userPermissions';
  import type { EventVenueType } from '$lib/types/calendar';
  import type { UserPermissions } from '$lib/config/types';
  import type { CalendarEvent } from '$lib/nostr/calendar';
  import {
    getEventVisibilityLayer,
    canUserRSVP,
    getCategoryIcon,
    getVenueTypeIcon,
    type VisibilityLayer,
    type CalendarDisplayEvent
  } from '$lib/utils/calendar-visibility';

  export let isExpanded: boolean = true;
  export let isVisible: boolean = true;

  let showFilters: boolean = false;
  let selectedVenueTypes: EventVenueType[] = [];
  let selectedSections: string[] = [];

  // Venue types for filter UI
  const venueTypeOptions: EventVenueType[] = ['fairfield', 'offsite', 'online', 'external'];
  const sectionOptions = ['public_lobby', 'community', 'dreamlab'];

  // Subscribe to stores
  $: selectedDate = $calendarStore.selectedDate || new Date();
  $: upcomingEvents = $calendarStore.upcomingEvents;
  $: userPermissions = $userPermissionsStore;

  // Group upcoming events by time period
  $: groupedEvents = groupEventsByPeriod(upcomingEvents, userPermissions);

  interface GroupedEvents {
    today: CalendarDisplayEvent[];
    tomorrow: CalendarDisplayEvent[];
    thisWeek: CalendarDisplayEvent[];
    later: CalendarDisplayEvent[];
  }

  function groupEventsByPeriod(
    events: CalendarEvent[],
    permissions: UserPermissions | null
  ): GroupedEvents {
    if (!permissions) {
      return { today: [], tomorrow: [], thisWeek: [], later: [] };
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const grouped: GroupedEvents = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: []
    };

    // Filter and group events
    const visibleEvents = events.filter((event) => {
      const displayEvent = event as CalendarDisplayEvent;
      const layer = getEventVisibilityLayer(displayEvent, permissions);
      return layer !== 'hidden';
    });

    visibleEvents.forEach((event) => {
      const eventStart = new Date(event.start * 1000);
      const displayEvent = event as CalendarDisplayEvent;

      if (eventStart >= todayStart && eventStart <= todayEnd) {
        grouped.today.push(displayEvent);
      } else if (eventStart >= tomorrowStart && eventStart <= tomorrowEnd) {
        grouped.tomorrow.push(displayEvent);
      } else if (eventStart > tomorrowEnd && eventStart <= weekEnd) {
        grouped.thisWeek.push(displayEvent);
      } else if (eventStart > weekEnd) {
        grouped.later.push(displayEvent);
      }
    });

    return grouped;
  }

  function getEventDisplayInfo(event: CalendarDisplayEvent, layer: VisibilityLayer) {
    if (layer === 'busy') {
      return {
        title: 'Private Event',
        showLocation: false,
        showAttendees: false,
        isBusy: true
      };
    }

    // Get category - handle both string and object formats
    const categoryPrimary = typeof event.category === 'object'
      ? event.category?.primary
      : event.category;

    if (layer === 'type') {
      return {
        title: categoryPrimary || 'Event',
        showLocation: event.venue?.type !== undefined,
        showAttendees: false,
        isBusy: false
      };
    }

    // Full access
    return {
      title: event.title || event.name || 'Untitled Event',
      showLocation: true,
      showAttendees: true,
      isBusy: false
    };
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function handleDateSelect(date: Date) {
    calendarStore.setSelectedDate(date);
  }

  function toggleSidebar() {
    isExpanded = !isExpanded;
    calendarStore.toggleSidebar();
  }

  function handleRSVP(event: CalendarDisplayEvent) {
    if (!userPermissions || !canUserRSVP(event, userPermissions)) {
      return;
    }
    // TODO: Implement RSVP functionality
    console.log('RSVP to event:', event.id);
  }

  function handleCreateEvent() {
    // TODO: Implement event creation
    console.log('Create new event');
  }

  function toggleVenueFilter(venueType: string) {
    const vt = venueType as EventVenueType;
    if (selectedVenueTypes.includes(vt)) {
      selectedVenueTypes = selectedVenueTypes.filter(v => v !== vt);
    } else {
      selectedVenueTypes = [...selectedVenueTypes, vt];
    }
    calendarStore.toggleFilter('venueTypes', venueType);
  }

  function toggleSectionFilter(sectionId: string) {
    if (selectedSections.includes(sectionId)) {
      selectedSections = selectedSections.filter(s => s !== sectionId);
    } else {
      selectedSections = [...selectedSections, sectionId];
    }
    calendarStore.toggleFilter('sections', sectionId);
  }

  onMount(() => {
    // Fetch upcoming events on mount
    calendarStore.fetchUpcomingEvents(14);
    return () => {
      // Cleanup if needed
    };
  });
</script>

<aside
  class="calendar-sidebar transition-all duration-300 ease-in-out flex flex-col h-screen bg-base-200 dark:bg-base-300 border-r border-base-300 dark:border-base-content/10"
  class:expanded={isExpanded}
  class:collapsed={!isExpanded}
  class:hidden={!isVisible}
>
  <!-- Header -->
  <div class="sidebar-header flex items-center justify-between p-4 border-b border-base-300 dark:border-base-content/10">
    {#if isExpanded}
      <h2 class="text-lg font-bold flex items-center gap-2">
        📅 FAIRFIELD CALENDAR
      </h2>
      <button
        class="btn btn-ghost btn-sm btn-square"
        on:click={toggleSidebar}
        aria-label="Collapse sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
      </button>
    {:else}
      <button
        class="btn btn-ghost btn-sm btn-square mx-auto"
        on:click={toggleSidebar}
        aria-label="Expand sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
          />
        </svg>
      </button>
    {/if}
  </div>

  {#if isExpanded}
    <div class="sidebar-content flex-1 overflow-y-auto overflow-x-hidden">
      <!-- MiniCalendar Section -->
      <div class="mini-calendar-section p-4 border-b border-base-300 dark:border-base-content/10">
        <MiniCalendar
          selectedDate={selectedDate}
          events={upcomingEvents}
          onDateSelect={handleDateSelect}
        />
      </div>

      <!-- Upcoming Events Section -->
      <div class="upcoming-section p-4 border-b border-base-300 dark:border-base-content/10">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold uppercase tracking-wide">Upcoming</h3>
          <button
            class="btn btn-ghost btn-xs btn-square"
            on:click={handleCreateEvent}
            aria-label="Create new event"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        <!-- TODAY -->
        {#if groupedEvents.today.length > 0}
          <div class="event-group mb-4">
            <h4 class="text-xs font-semibold uppercase text-base-content/60 mb-2">Today</h4>
            <div class="space-y-2">
              {#each groupedEvents.today as event}
                {@const layer = userPermissions ? getEventVisibilityLayer(event, userPermissions) : 'hidden'}
                {@const displayInfo = getEventDisplayInfo(event, layer)}
                {@const canRSVP = userPermissions && canUserRSVP(event, userPermissions)}

                <div
                  class="event-card p-3 rounded-lg bg-base-100 dark:bg-base-200 hover:shadow-md transition-shadow cursor-pointer"
                  class:opacity-75={displayInfo.isBusy}
                  class:bg-stripes={displayInfo.isBusy}
                >
                  <div class="flex items-start gap-2">
                    <span class="text-xs font-mono text-base-content/70 mt-0.5 min-w-[45px]">
                      {formatTime(event.start)}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-1">
                        {#if event.category}
                          <span class="text-base">{getCategoryIcon(event.category)}</span>
                        {/if}
                        <span class="text-sm font-medium truncate">
                          {displayInfo.title}
                        </span>
                      </div>

                      {#if displayInfo.showLocation && event.venue}
                        <div class="flex items-center gap-1 text-xs text-base-content/60 mb-1">
                          <span>{getVenueTypeIcon(event.venue.type)}</span>
                          <span class="truncate">
                            {event.venue.room || event.venue.address || event.venue.type}
                          </span>
                        </div>
                      {/if}

                      {#if displayInfo.showAttendees && event.attendance}
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-base-content/60">
                            {event.attendance.currentCount}
                            {#if event.attendance.maxCapacity}
                              / {event.attendance.maxCapacity}
                            {/if}
                            attending
                          </span>
                          {#if canRSVP}
                            <button
                              class="btn btn-xs btn-primary"
                              on:click|stopPropagation={() => handleRSVP(event)}
                            >
                              RSVP
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- TOMORROW -->
        {#if groupedEvents.tomorrow.length > 0}
          <div class="event-group mb-4">
            <h4 class="text-xs font-semibold uppercase text-base-content/60 mb-2">Tomorrow</h4>
            <div class="space-y-2">
              {#each groupedEvents.tomorrow as event}
                {@const layer = userPermissions ? getEventVisibilityLayer(event, userPermissions) : 'hidden'}
                {@const displayInfo = getEventDisplayInfo(event, layer)}
                {@const canRSVP = userPermissions && canUserRSVP(event, userPermissions)}

                <div
                  class="event-card p-3 rounded-lg bg-base-100 dark:bg-base-200 hover:shadow-md transition-shadow cursor-pointer"
                  class:opacity-75={displayInfo.isBusy}
                  class:bg-stripes={displayInfo.isBusy}
                >
                  <div class="flex items-start gap-2">
                    <span class="text-xs font-mono text-base-content/70 mt-0.5 min-w-[45px]">
                      {formatTime(event.start)}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-1">
                        {#if event.category}
                          <span class="text-base">{getCategoryIcon(event.category)}</span>
                        {/if}
                        <span class="text-sm font-medium truncate">
                          {displayInfo.title}
                        </span>
                      </div>

                      {#if displayInfo.showLocation && event.venue}
                        <div class="flex items-center gap-1 text-xs text-base-content/60 mb-1">
                          <span>{getVenueTypeIcon(event.venue.type)}</span>
                          <span class="truncate">
                            {event.venue.room || event.venue.address || event.venue.type}
                          </span>
                        </div>
                      {/if}

                      {#if displayInfo.showAttendees && event.attendance}
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-base-content/60">
                            {event.attendance.currentCount}
                            {#if event.attendance.maxCapacity}
                              / {event.attendance.maxCapacity}
                            {/if}
                            attending
                          </span>
                          {#if canRSVP}
                            <button
                              class="btn btn-xs btn-primary"
                              on:click|stopPropagation={() => handleRSVP(event)}
                            >
                              RSVP
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- THIS WEEK -->
        {#if groupedEvents.thisWeek.length > 0}
          <div class="event-group mb-4">
            <h4 class="text-xs font-semibold uppercase text-base-content/60 mb-2">This Week</h4>
            <div class="space-y-2">
              {#each groupedEvents.thisWeek.slice(0, 5) as event}
                {@const layer = userPermissions ? getEventVisibilityLayer(event, userPermissions) : 'hidden'}
                {@const displayInfo = getEventDisplayInfo(event, layer)}
                {@const canRSVP = userPermissions && canUserRSVP(event, userPermissions)}

                <div
                  class="event-card p-3 rounded-lg bg-base-100 dark:bg-base-200 hover:shadow-md transition-shadow cursor-pointer"
                  class:opacity-75={displayInfo.isBusy}
                  class:bg-stripes={displayInfo.isBusy}
                >
                  <div class="flex items-start gap-2">
                    <span class="text-xs font-mono text-base-content/70 mt-0.5 min-w-[45px]">
                      {formatTime(event.start)}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-1">
                        {#if event.category}
                          <span class="text-base">{getCategoryIcon(event.category)}</span>
                        {/if}
                        <span class="text-sm font-medium truncate">
                          {displayInfo.title}
                        </span>
                      </div>

                      {#if displayInfo.showLocation && event.venue}
                        <div class="flex items-center gap-1 text-xs text-base-content/60 mb-1">
                          <span>{getVenueTypeIcon(event.venue.type)}</span>
                          <span class="truncate">
                            {event.venue.room || event.venue.address || event.venue.type}
                          </span>
                        </div>
                      {/if}

                      {#if displayInfo.showAttendees && event.attendance}
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-base-content/60">
                            {event.attendance.currentCount}
                            {#if event.attendance.maxCapacity}
                              / {event.attendance.maxCapacity}
                            {/if}
                            attending
                          </span>
                          {#if canRSVP}
                            <button
                              class="btn btn-xs btn-primary"
                              on:click|stopPropagation={() => handleRSVP(event)}
                            >
                              RSVP
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- LATER -->
        {#if groupedEvents.later.length > 0}
          <div class="event-group">
            <h4 class="text-xs font-semibold uppercase text-base-content/60 mb-2">Later</h4>
            <div class="space-y-2">
              {#each groupedEvents.later.slice(0, 3) as event}
                {@const layer = userPermissions ? getEventVisibilityLayer(event, userPermissions) : 'hidden'}
                {@const displayInfo = getEventDisplayInfo(event, layer)}

                <div
                  class="event-card p-3 rounded-lg bg-base-100 dark:bg-base-200 hover:shadow-md transition-shadow cursor-pointer"
                  class:opacity-75={displayInfo.isBusy}
                  class:bg-stripes={displayInfo.isBusy}
                >
                  <div class="flex items-start gap-2">
                    <span class="text-xs font-mono text-base-content/70 mt-0.5 min-w-[45px]">
                      {new Date(event.start * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-1">
                        {#if event.category}
                          <span class="text-base">{getCategoryIcon(event.category)}</span>
                        {/if}
                        <span class="text-sm font-medium truncate">
                          {displayInfo.title}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if groupedEvents.today.length === 0 && groupedEvents.tomorrow.length === 0 && groupedEvents.thisWeek.length === 0 && groupedEvents.later.length === 0}
          <div class="text-center text-sm text-base-content/60 py-8">
            No upcoming events
          </div>
        {/if}
      </div>

      <!-- Filters Section -->
      <div class="filters-section p-4">
        <button
          class="w-full flex items-center justify-between text-sm font-bold uppercase tracking-wide mb-3"
          on:click={() => (showFilters = !showFilters)}
        >
          <span>Filters</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 transition-transform"
            class:rotate-180={showFilters}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {#if showFilters}
          <div class="filter-content space-y-4">
            <!-- Venue Type Filters -->
            <div>
              <h5 class="text-xs font-semibold uppercase text-base-content/60 mb-2">
                Venue Type
              </h5>
              <div class="space-y-1">
                {#each venueTypeOptions as venueType}
                  <label class="flex items-center gap-2 cursor-pointer hover:bg-base-100 dark:hover:bg-base-200 p-1 rounded">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={selectedVenueTypes.includes(venueType)}
                      on:change={() => toggleVenueFilter(venueType)}
                    />
                    <span class="text-sm capitalize">{venueType}</span>
                  </label>
                {/each}
              </div>
            </div>

            <!-- Section Filters -->
            <div>
              <h5 class="text-xs font-semibold uppercase text-base-content/60 mb-2">
                Section
              </h5>
              <div class="space-y-1">
                {#each sectionOptions as sectionId}
                  <label class="flex items-center gap-2 cursor-pointer hover:bg-base-100 dark:hover:bg-base-200 p-1 rounded">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={selectedSections.includes(sectionId)}
                      on:change={() => toggleSectionFilter(sectionId)}
                    />
                    <span class="text-sm capitalize">{sectionId.replace('_', ' ')}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</aside>

<style>
  .calendar-sidebar {
    position: relative;
  }

  .calendar-sidebar.expanded {
    width: 280px;
  }

  .calendar-sidebar.collapsed {
    width: 48px;
  }

  .calendar-sidebar.hidden {
    display: none;
  }

  /* Hatched pattern for busy slots */
  .bg-stripes {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.05) 10px,
      rgba(0, 0, 0, 0.05) 20px
    );
  }

  :global(.dark) .bg-stripes {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.05) 10px,
      rgba(255, 255, 255, 0.05) 20px
    );
  }

  /* Smooth transitions */
  .calendar-sidebar,
  .sidebar-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Scrollbar styling */
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: hsl(var(--bc) / 0.2);
    border-radius: 3px;
  }

  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--bc) / 0.3);
  }

  /* Event card hover effects */
  .event-card {
    transition: all 0.2s ease;
  }

  .event-card:hover {
    transform: translateY(-1px);
  }

  /* Rotate animation */
  .rotate-180 {
    transform: rotate(180deg);
  }
</style>
