import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { CalendarEvent } from '../nostr/calendar';
import { fetchUpcomingEvents, fetchAllEvents } from '../nostr/calendar';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

export interface CalendarFilters {
  sections: string[];
  categories: string[];
  venueTypes: string[];
}

export interface CalendarState {
  events: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  selectedDate: Date | null;
  viewMode: CalendarViewMode;
  filters: CalendarFilters;
  isLoading: boolean;
  sidebarExpanded: boolean;
  sidebarVisible: boolean;
  error: string | null;
}

const initialState: CalendarState = {
  events: [],
  upcomingEvents: [],
  selectedDate: null,
  viewMode: 'month',
  filters: {
    sections: [],
    categories: [],
    venueTypes: [],
  },
  isLoading: false,
  sidebarExpanded: true,
  sidebarVisible: true,
  error: null,
};

function createCalendarStore() {
  const { subscribe, set, update }: Writable<CalendarState> = writable(initialState);

  return {
    subscribe,

    /**
     * Fetch all calendar events
     */
    fetchEvents: async () => {
      update((state) => ({ ...state, isLoading: true, error: null }));

      try {
        const events = await fetchAllEvents();
        update((state) => ({
          ...state,
          events,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to fetch events:', error);
        update((state) => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch events',
        }));
      }
    },

    /**
     * Fetch upcoming events (next N days)
     */
    fetchUpcomingEvents: async (days: number = 14) => {
      update((state) => ({ ...state, isLoading: true, error: null }));

      try {
        const upcomingEvents = await fetchUpcomingEvents(days);
        update((state) => ({
          ...state,
          upcomingEvents,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to fetch upcoming events:', error);
        update((state) => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch upcoming events',
        }));
      }
    },

    /**
     * Set selected date
     */
    setSelectedDate: (date: Date | null) => {
      update((state) => ({ ...state, selectedDate: date }));
    },

    /**
     * Set view mode
     */
    setViewMode: (mode: CalendarViewMode) => {
      update((state) => ({ ...state, viewMode: mode }));
    },

    /**
     * Toggle a filter value on/off
     */
    toggleFilter: (type: keyof CalendarFilters, value: string) => {
      update((state) => {
        const filterArray = state.filters[type];
        const newFilterArray = filterArray.includes(value)
          ? filterArray.filter((v) => v !== value)
          : [...filterArray, value];

        return {
          ...state,
          filters: {
            ...state.filters,
            [type]: newFilterArray,
          },
        };
      });
    },

    /**
     * Clear all filters
     */
    clearFilters: () => {
      update((state) => ({
        ...state,
        filters: {
          sections: [],
          categories: [],
          venueTypes: [],
        },
      }));
    },

    /**
     * Toggle sidebar expanded state
     */
    toggleSidebar: () => {
      update((state) => ({ ...state, sidebarExpanded: !state.sidebarExpanded }));
    },

    /**
     * Set sidebar visibility
     */
    setSidebarVisible: (visible: boolean) => {
      update((state) => ({ ...state, sidebarVisible: visible }));
    },

    /**
     * Add a new event to the store (e.g., after creating one)
     */
    addEvent: (event: CalendarEvent) => {
      update((state) => ({
        ...state,
        events: [...state.events, event].sort((a, b) => a.start - b.start),
      }));
    },

    /**
     * Update an existing event in the store
     */
    updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => {
      update((state) => ({
        ...state,
        events: state.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
      }));
    },

    /**
     * Remove an event from the store
     */
    removeEvent: (eventId: string) => {
      update((state) => ({
        ...state,
        events: state.events.filter((e) => e.id !== eventId),
        upcomingEvents: state.upcomingEvents.filter((e) => e.id !== eventId),
      }));
    },

    /**
     * Clear error
     */
    clearError: () => {
      update((state) => ({ ...state, error: null }));
    },

    /**
     * Reset store to initial state
     */
    reset: () => set(initialState),
  };
}

export const calendarStore = createCalendarStore();

/**
 * Derived store for filtered events based on active filters
 */
export const filteredEvents = derived(calendarStore, ($calendar) => {
  const { events, filters } = $calendar;
  const { sections, categories, venueTypes } = filters;

  // If no filters are active, return all events
  if (sections.length === 0 && categories.length === 0 && venueTypes.length === 0) {
    return events;
  }

  return events.filter((event) => {
    // Filter by sections (tags)
    if (sections.length > 0) {
      const hasMatchingSection = event.tags?.some((tag) => sections.includes(tag));
      if (!hasMatchingSection) return false;
    }

    // Filter by categories (tags)
    if (categories.length > 0) {
      const hasMatchingCategory = event.tags?.some((tag) => categories.includes(tag));
      if (!hasMatchingCategory) return false;
    }

    // Filter by venue types (location-based)
    if (venueTypes.length > 0) {
      const hasMatchingVenue = event.location && venueTypes.some((type) =>
        event.location?.toLowerCase().includes(type.toLowerCase())
      );
      if (!hasMatchingVenue) return false;
    }

    return true;
  });
});

/**
 * Derived store for today's events
 */
export const todayEvents = derived(calendarStore, ($calendar) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = Math.floor(today.getTime() / 1000);
  const tomorrowTimestamp = todayTimestamp + 86400;

  return $calendar.events.filter((event) => {
    return event.start >= todayTimestamp && event.start < tomorrowTimestamp;
  });
});

/**
 * Derived store for events grouped by date
 */
export const eventsByDate = derived(filteredEvents, ($events) => {
  const eventMap = new Map<string, CalendarEvent[]>();

  $events.forEach((event) => {
    const date = new Date(event.start * 1000);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!eventMap.has(dateString)) {
      eventMap.set(dateString, []);
    }
    eventMap.get(dateString)!.push(event);
  });

  // Sort events within each date
  eventMap.forEach((events) => {
    events.sort((a, b) => a.start - b.start);
  });

  return eventMap;
});

/**
 * Derived store for current view mode
 */
export const viewMode = derived(calendarStore, ($calendar) => $calendar.viewMode);

/**
 * Derived store for selected date
 */
export const selectedDate = derived(calendarStore, ($calendar) => $calendar.selectedDate);

/**
 * Derived store for sidebar state
 */
export const sidebarExpanded = derived(calendarStore, ($calendar) => $calendar.sidebarExpanded);
export const sidebarVisible = derived(calendarStore, ($calendar) => $calendar.sidebarVisible);

/**
 * Derived store for loading state
 */
export const isLoading = derived(calendarStore, ($calendar) => $calendar.isLoading);
