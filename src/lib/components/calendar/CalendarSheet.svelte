<script lang="ts">
  import { spring } from 'svelte/motion';
  import { onMount, onDestroy } from 'svelte';
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarStore, todayEvents, filteredEvents } from '$lib/stores/calendar';
  import { getSections } from '$lib/config';
  import type { CalendarEvent } from '$lib/nostr/calendar';

  export let isOpen = true;

  // Snap points (in vh units)
  const SNAP_COLLAPSED = 8;  // 60px ~ 8vh
  const SNAP_HALF = 50;
  const SNAP_FULL = 90;

  // Spring animation for smooth transitions
  const height = spring(SNAP_COLLAPSED, {
    stiffness: 0.1,
    damping: 0.5
  });

  let sheetElement: HTMLDivElement;
  let isDragging = false;
  let startY = 0;
  let currentHeight = SNAP_COLLAPSED;
  let showFilters = false;
  let selectedEventId: string | null = null;

  $: sections = getSections();
  $: events = $calendarStore.events;
  $: upcomingEvents = $calendarStore.upcomingEvents;
  $: filters = $calendarStore.filters;
  $: todayEventCount = $todayEvents.length;
  $: isCollapsed = currentHeight === SNAP_COLLAPSED;
  $: isExpanded = currentHeight === SNAP_HALF || currentHeight === SNAP_FULL;

  // Get events for selected date or upcoming
  $: displayedEvents = getDisplayedEvents();

  function getDisplayedEvents(): CalendarEvent[] {
    if ($calendarStore.selectedDate) {
      const selectedDay = new Date($calendarStore.selectedDate);
      selectedDay.setHours(0, 0, 0, 0);
      const dayStart = Math.floor(selectedDay.getTime() / 1000);
      const dayEnd = dayStart + 86400;

      return $filteredEvents.filter(e => e.start >= dayStart && e.start < dayEnd);
    }
    return upcomingEvents.slice(0, 10);
  }

  function snapToHeight(target: number) {
    currentHeight = target;
    height.set(target);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.target instanceof HTMLElement) {
      // Only start drag if touching the handle or header area
      const handle = sheetElement.querySelector('.sheet-handle');
      const header = sheetElement.querySelector('.sheet-header');
      if (handle?.contains(e.target) || header?.contains(e.target)) {
        isDragging = true;
        startY = e.touches[0].clientY;
      }
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;

    const deltaY = startY - e.touches[0].clientY;
    const viewportHeight = window.innerHeight;
    const deltaVh = (deltaY / viewportHeight) * 100;

    let newHeight = currentHeight + deltaVh;
    newHeight = Math.max(SNAP_COLLAPSED, Math.min(SNAP_FULL, newHeight));

    height.set(newHeight, { hard: true });
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const current = $height;

    // Snap to nearest point
    if (current < (SNAP_COLLAPSED + SNAP_HALF) / 2) {
      snapToHeight(SNAP_COLLAPSED);
    } else if (current < (SNAP_HALF + SNAP_FULL) / 2) {
      snapToHeight(SNAP_HALF);
    } else {
      snapToHeight(SNAP_FULL);
    }
  }

  function handleCollapsedClick() {
    if (isCollapsed) {
      snapToHeight(SNAP_HALF);
    }
  }

  function handleBackdropClick() {
    snapToHeight(SNAP_COLLAPSED);
  }

  function handleDateSelect(date: Date) {
    calendarStore.setSelectedDate(date);
  }

  function formatEventTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatEventDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getSectionColor(section?: string): string {
    if (!section) return 'bg-base-content';

    const sectionConfig = sections.find(s => s.id === section);
    if (!sectionConfig) return 'bg-base-content';

    const colorMap: Record<string, string> = {
      'primary': 'bg-primary',
      'secondary': 'bg-secondary',
      'accent': 'bg-accent',
      'info': 'bg-info',
      'success': 'bg-success',
      'warning': 'bg-warning',
      'error': 'bg-error'
    };

    return colorMap[sectionConfig.ui?.color] || 'bg-base-content';
  }

  function handleCreateEvent() {
    // Navigate to create event page or open modal
    window.location.href = '/calendar/create';
  }

  function toggleEventDetails(eventId: string) {
    selectedEventId = selectedEventId === eventId ? null : eventId;
  }

  onMount(() => {
    // Fetch events on mount
    calendarStore.fetchEvents();
    calendarStore.fetchUpcomingEvents();

    // Add touch event listeners
    if (sheetElement) {
      sheetElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      sheetElement.addEventListener('touchmove', handleTouchMove, { passive: true });
      sheetElement.addEventListener('touchend', handleTouchEnd);
    }
  });

  onDestroy(() => {
    if (sheetElement) {
      sheetElement.removeEventListener('touchstart', handleTouchStart);
      sheetElement.removeEventListener('touchmove', handleTouchMove);
      sheetElement.removeEventListener('touchend', handleTouchEnd);
    }
  });
</script>

{#if isOpen}
  <!-- Backdrop (only visible when expanded) -->
  {#if isExpanded}
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
      class:opacity-0={isCollapsed}
      class:opacity-100={isExpanded}
      on:click={handleBackdropClick}
      on:keydown={(e) => e.key === 'Escape' && handleBackdropClick()}
      role="button"
      tabindex="0"
      aria-label="Close calendar"
    />
  {/if}

  <!-- Bottom Sheet -->
  <div
    bind:this={sheetElement}
    class="fixed bottom-0 left-0 right-0 bg-base-100 dark:bg-base-200 rounded-t-2xl shadow-2xl z-50 flex flex-col"
    style="height: {$height}vh; max-height: {$height}vh;"
  >
    <!-- Drag Handle -->
    <div class="sheet-handle flex justify-center py-2 cursor-grab active:cursor-grabbing">
      <div class="w-12 h-1 bg-base-content/30 rounded-full" />
    </div>

    <!-- Collapsed Header (always visible) -->
    <div
      class="sheet-header px-4 pb-2 cursor-pointer"
      on:click={handleCollapsedClick}
      on:keydown={(e) => e.key === 'Enter' && handleCollapsedClick()}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">📅</span>
          <span class="font-semibold text-base">
            {todayEventCount} {todayEventCount === 1 ? 'event' : 'events'} today
          </span>
        </div>
        {#if isCollapsed}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-base-content/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        {/if}
      </div>
    </div>

    <!-- Expanded Content (only visible when not collapsed) -->
    {#if isExpanded}
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <!-- Calendar -->
        <div class="flex justify-center">
          <MiniCalendar
            selectedDate={$calendarStore.selectedDate || new Date()}
            {events}
            onDateSelect={handleDateSelect}
          />
        </div>

        <!-- Filters (Collapsible) -->
        <div class="border-t border-base-300 pt-4">
          <button
            class="w-full flex items-center justify-between py-2"
            on:click={() => showFilters = !showFilters}
          >
            <span class="font-semibold">Filters</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 transition-transform duration-200"
              class:rotate-180={showFilters}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {#if showFilters}
            <div class="mt-2 space-y-2">
              <!-- Section filters -->
              <div>
                <label class="text-xs text-base-content/60 uppercase tracking-wider">Sections</label>
                <div class="flex flex-wrap gap-2 mt-1">
                  {#each sections as section}
                    <button
                      class="badge badge-sm {filters.sections.includes(section.id) ? getSectionColor(section.id) : 'badge-outline'}"
                      on:click={() => calendarStore.toggleFilter('sections', section.id)}
                    >
                      {section.name}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Clear filters -->
              {#if filters.sections.length > 0 || filters.categories.length > 0 || filters.venueTypes.length > 0}
                <button
                  class="btn btn-sm btn-ghost w-full"
                  on:click={() => calendarStore.clearFilters()}
                >
                  Clear All Filters
                </button>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Upcoming Events -->
        <div class="border-t border-base-300 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-lg">
              {$calendarStore.selectedDate ? 'Events on ' + formatEventDate($calendarStore.selectedDate.getTime() / 1000) : 'Upcoming Events'}
            </h3>
            <button
              class="btn btn-sm btn-circle btn-primary"
              on:click={handleCreateEvent}
              aria-label="Create event"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {#if displayedEvents.length === 0}
            <div class="text-center py-8 text-base-content/60">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No events found</p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each displayedEvents as event (event.id)}
                <div class="bg-base-200 dark:bg-base-300 rounded-lg p-3">
                  <button
                    class="w-full text-left"
                    on:click={() => toggleEventDetails(event.id)}
                  >
                    <div class="flex items-start gap-3">
                      <div class="flex-shrink-0 pt-1">
                        <div class="w-2 h-2 rounded-full {getSectionColor(event.tags?.[0])}" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="font-semibold truncate">{event.title || 'Untitled Event'}</h4>
                        <div class="flex items-center gap-2 text-sm text-base-content/60 mt-1">
                          <span>{formatEventTime(event.start)}</span>
                          {#if event.location}
                            <span>•</span>
                            <span class="truncate">{event.location}</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </button>

                  {#if selectedEventId === event.id}
                    <div class="mt-3 pt-3 border-t border-base-300 space-y-2 text-sm">
                      {#if event.description}
                        <p class="text-base-content/80">{event.description}</p>
                      {/if}
                      {#if event.end}
                        <p class="text-base-content/60">
                          Ends: {formatEventTime(event.end)}
                        </p>
                      {/if}
                      {#if event.tags && event.tags.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each event.tags as tag}
                            <span class="badge badge-xs {getSectionColor(tag)}">{tag}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Smooth scrolling for event list */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }

  /* Prevent text selection during drag */
  .sheet-handle,
  .sheet-header {
    user-select: none;
    -webkit-user-select: none;
  }

  /* Ensure proper stacking */
  .z-40 {
    z-index: 40;
  }

  .z-50 {
    z-index: 50;
  }
</style>
