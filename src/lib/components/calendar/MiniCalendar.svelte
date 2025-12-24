<script lang="ts">
  import type { ChannelSection } from '$lib/types/channel';
  import { getSections } from '$lib/config';

  interface EventWithSection {
    id: string;
    start: number;
    end: number;
    section?: ChannelSection;
    title?: string;
  }

  export let selectedDate: Date = new Date();
  export let events: EventWithSection[] = [];
  export let onDateSelect: (date: Date) => void = () => {};

  let currentViewDate: Date = new Date(selectedDate);

  $: year = currentViewDate.getFullYear();
  $: month = currentViewDate.getMonth();
  $: weeks = getWeeksInMonth(year, month);
  $: sections = getSections();

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  function getWeeksInMonth(year: number, month: number): Date[][] {
    const weeks: Date[][] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from Monday of the first week (ISO week date)
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToMonday);

    let currentWeek: Date[] = [];
    const current = new Date(startDate);

    // Generate exactly 6 weeks
    for (let i = 0; i < 42; i++) {
      currentWeek.push(new Date(current));

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      current.setDate(current.getDate() + 1);
    }

    return weeks;
  }

  function getEventsForDate(date: Date): EventWithSection[] {
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

  function isSelected(date: Date): boolean {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === month;
  }

  function getSectionColor(section?: ChannelSection): string {
    if (!section) return 'bg-base-content';

    const sectionConfig = sections.find(s => s.id === section);
    if (!sectionConfig) return 'bg-base-content';

    // Map section colors to Tailwind classes
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

  function prevMonth() {
    currentViewDate = new Date(year, month - 1, 1);
  }

  function nextMonth() {
    currentViewDate = new Date(year, month + 1, 1);
  }

  function handleDayClick(date: Date) {
    selectedDate = date;
    onDateSelect(date);
  }
</script>

<div class="w-full max-w-[250px]">
  <!-- Month/Year Header with Navigation -->
  <div class="flex items-center justify-between mb-2">
    <button
      class="btn btn-xs btn-ghost btn-square"
      on:click={prevMonth}
      aria-label="Previous month"
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
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>

    <h3 class="text-sm font-bold">
      {monthNames[month]} {year}
    </h3>

    <button
      class="btn btn-xs btn-ghost btn-square"
      on:click={nextMonth}
      aria-label="Next month"
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
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  </div>

  <!-- Day of Week Headers -->
  <div class="grid grid-cols-7 gap-px mb-1">
    {#each dayNames as day}
      <div class="text-center text-[10px] font-medium text-base-content/60 uppercase">
        {day}
      </div>
    {/each}
  </div>

  <!-- Calendar Grid -->
  <div class="grid grid-cols-7 gap-px bg-base-300 rounded-lg overflow-hidden">
    {#each weeks as week}
      {#each week as date}
        {@const dayEvents = getEventsForDate(date)}
        {@const today = isToday(date)}
        {@const selected = isSelected(date)}
        {@const currentMonth = isCurrentMonth(date)}
        <button
          class="aspect-square p-1 bg-base-100 dark:bg-base-200 hover:bg-base-200 dark:hover:bg-base-300 transition-colors flex flex-col items-center justify-start relative"
          class:bg-primary={selected}
          class:text-primary-content={selected}
          class:ring-2={today && !selected}
          class:ring-primary={today && !selected}
          class:ring-inset={today && !selected}
          class:opacity-40={!currentMonth}
          on:click={() => handleDayClick(date)}
          aria-label={`Select ${date.toLocaleDateString()}`}
        >
          <span
            class="text-[11px] font-medium"
            class:text-primary={today && !selected}
          >
            {date.getDate()}
          </span>

          <!-- Event Dots -->
          {#if dayEvents.length > 0}
            <div class="flex gap-[2px] mt-auto">
              {#each dayEvents.slice(0, 3) as event}
                <div
                  class="w-1 h-1 rounded-full {getSectionColor(event.section)}"
                  class:opacity-50={!currentMonth}
                  title={event.title || 'Event'}
                />
              {/each}
            </div>
          {/if}
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  /* Ensure grid items maintain aspect ratio */
  .aspect-square {
    aspect-ratio: 1 / 1;
  }
</style>
