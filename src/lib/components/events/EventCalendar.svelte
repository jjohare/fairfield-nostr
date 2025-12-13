<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CalendarEvent } from '$lib/nostr/calendar';

  export let events: CalendarEvent[] = [];
  export let currentDate: Date = new Date();

  const dispatch = createEventDispatcher();

  let viewMode: 'month' | 'week' = 'month';

  $: year = currentDate.getFullYear();
  $: month = currentDate.getMonth();
  $: daysInMonth = new Date(year, month + 1, 0).getDate();
  $: firstDayOfMonth = new Date(year, month, 1).getDay();

  $: weeks = getWeeksInMonth(year, month);

  function getWeeksInMonth(year: number, month: number): Date[][] {
    const weeks: Date[][] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    let currentWeek: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || currentWeek.length < 7) {
      currentWeek.push(new Date(current));

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      current.setDate(current.getDate() + 1);

      // Break after 6 weeks max
      if (weeks.length >= 6 && currentWeek.length === 0) break;
    }

    if (currentWeek.length > 0) {
      // Pad remaining days
      while (currentWeek.length < 7) {
        currentWeek.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }

  function getEventsForDate(date: Date): CalendarEvent[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayStartTs = Math.floor(dayStart.getTime() / 1000);
    const dayEndTs = Math.floor(dayEnd.getTime() / 1000);

    return events.filter((event) => {
      return event.start >= dayStartTs && event.start <= dayEndTs;
    });
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === month;
  }

  function prevMonth() {
    currentDate = new Date(year, month - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
  }

  function handleDayClick(date: Date) {
    dispatch('dayClick', date);
  }

  function handleEventClick(event: CalendarEvent) {
    dispatch('eventClick', event);
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <!-- Calendar Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-xl font-bold">{monthNames[month]} {year}</h3>
        <button class="btn btn-xs btn-ghost" on:click={goToToday}>Today</button>
      </div>

      <div class="flex items-center gap-1">
        <button class="btn btn-sm btn-ghost" on:click={prevMonth}>
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button class="btn btn-sm btn-ghost" on:click={nextMonth}>
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Day Headers -->
    <div class="grid grid-cols-7 gap-1 mb-1">
      {#each dayNames as day}
        <div class="text-center text-xs font-medium text-base-content/60 py-1">
          {day}
        </div>
      {/each}
    </div>

    <!-- Calendar Grid -->
    <div class="grid grid-cols-7 gap-1">
      {#each weeks as week}
        {#each week as date}
          {@const dayEvents = getEventsForDate(date)}
          <button
            class="min-h-[80px] p-1 rounded-lg transition-colors text-left"
            class:bg-base-300={isCurrentMonth(date)}
            class:bg-base-200={!isCurrentMonth(date)}
            class:opacity-40={!isCurrentMonth(date)}
            class:ring-2={isToday(date)}
            class:ring-primary={isToday(date)}
            on:click={() => handleDayClick(date)}
          >
            <div class="text-xs font-medium" class:text-primary={isToday(date)}>
              {date.getDate()}
            </div>

            {#if dayEvents.length > 0}
              <div class="mt-1 space-y-0.5">
                {#each dayEvents.slice(0, 3) as event}
                  <button
                    class="block w-full text-left text-xs px-1 py-0.5 rounded truncate bg-primary/20 text-primary hover:bg-primary/30"
                    on:click|stopPropagation={() => handleEventClick(event)}
                  >
                    {event.title}
                  </button>
                {/each}
                {#if dayEvents.length > 3}
                  <div class="text-xs text-base-content/50 px-1">+{dayEvents.length - 3} more</div>
                {/if}
              </div>
            {/if}
          </button>
        {/each}
      {/each}
    </div>

    <!-- Events Summary -->
    {#if events.length > 0}
      <div class="mt-4 pt-4 border-t border-base-300">
        <div class="flex items-center justify-between">
          <span class="text-sm text-base-content/60">{events.length} events this month</span>
          <button class="btn btn-xs btn-ghost" on:click={() => dispatch('viewAll')}>
            View All
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
