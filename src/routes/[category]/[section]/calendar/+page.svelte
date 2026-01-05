<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { userStore } from '$lib/stores/user';
  import { ndk, connectRelay, isConnected } from '$lib/nostr/relay';
  import { RELAY_URL, getSectionWithCategory, getBreadcrumbs, getCategories } from '$lib/config';
  import {
    fetchSectionEvents,
    getSectionCalendarAccess,
    type SectionEvent,
  } from '$lib/nostr/section-events';
  import { fetchTribeBirthdayEvents } from '$lib/nostr/birthdays';
  import type { CalendarEvent } from '$lib/nostr/calendar';
  import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
  import EventCalendar from '$lib/components/events/EventCalendar.svelte';

  let events: (SectionEvent | CalendarEvent)[] = [];
  let loading = true;
  let error: string | null = null;
  let currentDate = new Date();
  let viewMode: 'calendar' | 'list' = 'calendar';
  let accessLevel: 'full' | 'availability' | 'none' = 'none';

  $: categoryId = $page.params.category;
  $: sectionId = $page.params.section;
  $: sectionInfo = getSectionWithCategory(sectionId);
  $: section = sectionInfo?.section;
  $: category = sectionInfo?.category;
  $: breadcrumbs = section && category ? [...getBreadcrumbs(categoryId, sectionId), { label: 'Calendar', path: `/${categoryId}/${sectionId}/calendar` }] : [];
  $: userCohorts = $userStore.profile?.cohorts || [];
  $: categories = getCategories();

  onMount(async () => {
    await authStore.waitForReady();

    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    if (!section || !category) {
      error = `Section "${sectionId}" not found`;
      loading = false;
      return;
    }

    // Check calendar access using section ID cast to ChannelSection
    accessLevel = getSectionCalendarAccess(userCohorts, sectionId as import('$lib/types/channel').ChannelSection);

    if (accessLevel === 'none') {
      error = 'You do not have access to this section calendar';
      loading = false;
      return;
    }

    try {
      if (!isConnected() && $authStore.privateKey) {
        await connectRelay(RELAY_URL, $authStore.privateKey);
      }

      // Fetch section events
      const sectionEvents = await fetchSectionEvents(sectionId as import('$lib/types/channel').ChannelSection);

      // Also fetch tribe birthdays for community sections
      let birthdayEvents: CalendarEvent[] = [];
      if (sectionId === 'community-rooms' && $authStore.publicKey) {
        birthdayEvents = await fetchTribeBirthdayEvents($authStore.publicKey);
      }

      events = [...sectionEvents, ...birthdayEvents].sort((a, b) => a.start - b.start);
    } catch (e) {
      console.error('Failed to load section events:', e);
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  });

  function handleEventClick(event: CustomEvent<SectionEvent | CalendarEvent>) {
    const ev = event.detail;
    if ('messageId' in ev && ev.messageId) {
      goto(`${base}/chat?channel=${ev.channelId}&message=${ev.messageId}`);
    }
  }

  function handleDayClick(event: CustomEvent<Date>) {
    console.log('Day clicked:', event.detail);
  }

  function navigateToSectionCalendar(catId: string, secId: string) {
    goto(`${base}/${catId}/${secId}/calendar`);
  }

  function formatEventForDisplay(event: SectionEvent | CalendarEvent): CalendarEvent {
    if (accessLevel === 'availability' && !('id' in event && event.id.startsWith('birthday-'))) {
      return {
        ...event,
        title: 'Event (Details Hidden)',
        description: '',
        location: undefined,
      };
    }
    return event;
  }

  $: displayEvents = events.map(formatEventForDisplay);
</script>

<svelte:head>
  <title>{section?.name || 'Section'} Calendar - Nostr BBS</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <Breadcrumb items={breadcrumbs} />

  <div class="mt-6 mb-6">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold mb-2">
          {#if section}
            <span class="mr-2">{section.icon}</span>
            {section.name} Calendar
          {:else}
            Section Calendar
          {/if}
        </h1>
        <p class="text-base-content/70">
          {#if section}
            {section.description}
          {/if}
        </p>
        {#if accessLevel === 'availability'}
          <div class="badge badge-warning mt-2">Availability Only - Join section for details</div>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <div class="btn-group">
          <button
            class="btn btn-sm"
            class:btn-active={viewMode === 'calendar'}
            on:click={() => (viewMode = 'calendar')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            class="btn btn-sm"
            class:btn-active={viewMode === 'list'}
            on:click={() => (viewMode = 'list')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Sidebar - Section Calendars -->
    <div class="lg:w-64 space-y-4">
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body p-4">
          <h3 class="font-bold text-sm mb-3">Section Calendars</h3>
          <div class="space-y-2">
            {#each categories as cat}
              <div class="text-xs text-base-content/60 uppercase font-semibold mt-2">{cat.icon} {cat.name}</div>
              {#each cat.sections || [] as sec}
                <button
                  class="btn btn-sm btn-block justify-start gap-2"
                  class:btn-primary={sectionId === sec.id}
                  class:btn-ghost={sectionId !== sec.id}
                  on:click={() => navigateToSectionCalendar(cat.id, sec.id)}
                >
                  <span>{sec.icon}</span>
                  <span class="truncate">{sec.name}</span>
                </button>
              {/each}
            {/each}
          </div>
        </div>
      </div>

      <div class="card bg-base-200 shadow-lg">
        <div class="card-body p-4">
          <h3 class="font-bold text-sm mb-3">Event Stats</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-base-content/60">Total Events</span>
              <span class="font-medium">{events.length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-base-content/60">Upcoming</span>
              <span class="font-medium">
                {events.filter((e) => e.start > Date.now() / 1000).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-200 shadow-lg">
        <div class="card-body p-4">
          <h3 class="font-bold text-sm mb-3">Access Level</h3>
          <div class="flex items-center gap-2">
            {#if accessLevel === 'full'}
              <div class="badge badge-success">Full Access</div>
            {:else if accessLevel === 'availability'}
              <div class="badge badge-warning">Availability Only</div>
            {:else}
              <div class="badge badge-error">No Access</div>
            {/if}
          </div>
          {#if section?.calendar?.canCreate && accessLevel === 'full'}
            <p class="text-xs text-base-content/60 mt-2">
              You can create events in this section
            </p>
          {/if}
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
          events={displayEvents}
          {currentDate}
          on:eventClick={handleEventClick}
          on:dayClick={handleDayClick}
        />
      {:else}
        <div class="space-y-3">
          {#if displayEvents.length === 0}
            <div class="card bg-base-200">
              <div class="card-body items-center text-center">
                <p class="text-base-content/70">No events in this section</p>
              </div>
            </div>
          {:else}
            {#each displayEvents as event (event.id)}
              <div
                class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors"
                on:click={() => handleEventClick(new CustomEvent('click', { detail: event }))}
                on:keydown={(e) => e.key === 'Enter' && handleEventClick(new CustomEvent('click', { detail: event }))}
                role="button"
                tabindex="0"
              >
                <div class="card-body p-4">
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="font-bold">{event.title}</h3>
                      {#if accessLevel === 'full' && event.description}
                        <p class="text-sm text-base-content/70 line-clamp-2 mt-1">
                          {event.description}
                        </p>
                      {/if}
                    </div>
                    <div class="text-right text-sm">
                      <div class="font-medium">
                        {new Date(event.start * 1000).toLocaleDateString()}
                      </div>
                      <div class="text-base-content/60">
                        {new Date(event.start * 1000).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                  {#if accessLevel === 'full' && event.location}
                    <div class="flex items-center gap-1 text-sm text-base-content/60 mt-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.location}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
