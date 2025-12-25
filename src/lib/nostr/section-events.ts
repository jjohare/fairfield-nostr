/**
 * Section Events Module
 * Fetches and manages events by section with access control
 */

import { ndk, isConnected } from './relay';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type { CalendarEvent } from './calendar';
import type { EventMetadata, RecurrencePattern, ChannelSection } from '$lib/types/channel';
import { getSections, getSection } from '$lib/config';
import { browser } from '$app/environment';

export interface SectionEvent extends CalendarEvent {
  sectionId: ChannelSection;
  messageId: string; // Link back to the original message/post
  authorPubkey: string;
  recurrence?: RecurrencePattern;
  recurrenceEnd?: number;
}

/**
 * Parse event metadata from message tags
 */
function parseEventFromTags(event: NDKEvent): EventMetadata | null {
  const eventTag = event.tags.find((t) => t[0] === 'event' && t[1] === 'true');
  if (!eventTag) return null;

  const startTag = event.tags.find((t) => t[0] === 'event_start');
  const endTag = event.tags.find((t) => t[0] === 'event_end');

  if (!startTag) return null;

  const locationTag = event.tags.find((t) => t[0] === 'event_location');
  const recurrenceTag = event.tags.find((t) => t[0] === 'event_recurrence');
  const recurrenceEndTag = event.tags.find((t) => t[0] === 'event_recurrence_end');
  const timezoneTag = event.tags.find((t) => t[0] === 'event_timezone');

  return {
    isEvent: true,
    startDate: parseInt(startTag[1], 10),
    endDate: endTag ? parseInt(endTag[1], 10) : parseInt(startTag[1], 10),
    location: locationTag?.[1],
    recurrence: (recurrenceTag?.[1] as RecurrencePattern) || 'none',
    recurrenceEnd: recurrenceEndTag ? parseInt(recurrenceEndTag[1], 10) : undefined,
    timezone: timezoneTag?.[1],
  };
}

/**
 * Get section ID from channel ID
 * Channels have a section tag that maps them to sections
 */
async function getChannelSection(channelId: string): Promise<ChannelSection | null> {
  const ndkInstance = ndk();
  if (!ndkInstance) return null;

  try {
    // Fetch the channel creation event (kind 40)
    const filter: NDKFilter = {
      kinds: [40],
      ids: [channelId],
      limit: 1,
    };

    const events = await ndkInstance.fetchEvents(filter);
    const channelEvent = Array.from(events)[0];

    if (channelEvent) {
      const sectionTag = channelEvent.tags.find((t) => t[0] === 'section');
      if (sectionTag?.[1]) {
        return sectionTag[1] as ChannelSection;
      }
    }

    // Default to public-lobby if no section found
    return 'public-lobby';
  } catch (error) {
    console.error('Failed to get channel section:', error);
    return null;
  }
}

/**
 * Fetch all events for a specific section
 * Only returns events from channels in that section
 */
export async function fetchSectionEvents(sectionId: ChannelSection): Promise<SectionEvent[]> {
  const ndkInstance = ndk();
  if (!ndkInstance) {
    console.error('NDK not initialized');
    return [];
  }

  try {
    // Fetch all group messages that have event tags (kind 9)
    const filter: NDKFilter = {
      kinds: [9],
      limit: 500,
    };

    const events = await ndkInstance.fetchEvents(filter);
    const sectionEvents: SectionEvent[] = [];

    for (const event of events) {
      const eventMeta = parseEventFromTags(event);
      if (!eventMeta) continue;

      // Get channel ID from the h tag (NIP-29)
      const channelTag = event.tags.find((t) => t[0] === 'h');
      const channelId = channelTag?.[1];

      if (!channelId) continue;

      // Check if this channel belongs to the requested section
      const channelSection = await getChannelSection(channelId);
      if (channelSection !== sectionId) continue;

      // Create section event
      const sectionEvent: SectionEvent = {
        id: event.id,
        title: event.content.slice(0, 100), // First 100 chars as title
        description: event.content,
        start: eventMeta.startDate,
        end: eventMeta.endDate,
        location: eventMeta.location,
        channelId,
        sectionId,
        messageId: event.id,
        createdBy: event.pubkey,
        authorPubkey: event.pubkey,
        recurrence: eventMeta.recurrence,
        recurrenceEnd: eventMeta.recurrenceEnd,
        tags: event.tags.filter((t) => t[0] === 't').map((t) => t[1]),
      };

      sectionEvents.push(sectionEvent);

      // Generate recurring events if applicable
      if (eventMeta.recurrence && eventMeta.recurrence !== 'none') {
        const recurringEvents = generateRecurringEvents(sectionEvent, eventMeta);
        sectionEvents.push(...recurringEvents);
      }
    }

    // Sort by start date
    return sectionEvents.sort((a, b) => a.start - b.start);
  } catch (error) {
    console.error('Failed to fetch section events:', error);
    return [];
  }
}

/**
 * Generate recurring event instances
 */
function generateRecurringEvents(
  baseEvent: SectionEvent,
  metadata: EventMetadata
): SectionEvent[] {
  const events: SectionEvent[] = [];
  const now = Math.floor(Date.now() / 1000);
  const oneYearFromNow = now + 365 * 24 * 60 * 60;
  const endLimit = metadata.recurrenceEnd || oneYearFromNow;

  let currentStart = baseEvent.start;
  let currentEnd = baseEvent.end;
  const duration = currentEnd - currentStart;
  let count = 0;
  const maxOccurrences = 52; // Limit to prevent infinite loops

  // Get interval in seconds
  const intervals: Record<RecurrencePattern, number> = {
    none: 0,
    daily: 24 * 60 * 60,
    weekly: 7 * 24 * 60 * 60,
    biweekly: 14 * 24 * 60 * 60,
    monthly: 30 * 24 * 60 * 60, // Approximate
    yearly: 365 * 24 * 60 * 60, // Approximate
  };

  const interval = intervals[metadata.recurrence];
  if (!interval) return events;

  // Generate future occurrences
  while (currentStart + interval <= endLimit && count < maxOccurrences) {
    currentStart += interval;
    currentEnd = currentStart + duration;
    count++;

    if (currentStart > now) {
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}-recurring-${count}`,
        start: currentStart,
        end: currentEnd,
      });
    }
  }

  return events;
}

/**
 * Get upcoming events across all sections the user has access to
 */
export async function fetchUpcomingSectionEvents(
  userPubkey: string,
  userCohorts: string[],
  days: number = 7
): Promise<SectionEvent[]> {
  const sections = getSections();
  const allEvents: SectionEvent[] = [];
  const now = Math.floor(Date.now() / 1000);
  const futureLimit = now + days * 24 * 60 * 60;

  for (const section of sections) {
    // Check user access before fetching events
    if (!canViewSectionEvents(userCohorts, section.id as ChannelSection)) {
      continue; // Skip this section
    }
    const sectionEvents = await fetchSectionEvents(section.id as ChannelSection);
    allEvents.push(
      ...sectionEvents.filter((e) => e.start >= now && e.start <= futureLimit)
    );
  }

  return allEvents.sort((a, b) => a.start - b.start);
}

/**
 * Check if user has access to view events in a section
 */
export function canViewSectionEvents(
  userCohorts: string[],
  sectionId: ChannelSection
): boolean {
  const section = getSection(sectionId);
  if (!section) return false;

  // Check if section requires approval
  if (!section.access.requiresApproval) {
    return true; // Open section
  }

  // Check if user has required cohorts
  const requiredCohorts = section.access.requiredCohorts || [];
  if (requiredCohorts.length === 0) {
    return true; // No specific cohort required
  }

  return requiredCohorts.some((cohort) => userCohorts.includes(cohort));
}

/**
 * Get section calendar access level for a user
 */
export function getSectionCalendarAccess(
  userCohorts: string[],
  sectionId: ChannelSection
): 'full' | 'availability' | 'none' {
  const section = getSection(sectionId);
  if (!section) return 'none';

  const calendarConfig = section.calendar;

  if (calendarConfig.access === 'none') return 'none';

  // If cohort restricted, check membership
  if (calendarConfig.cohortRestricted) {
    const requiredCohorts = section.access.requiredCohorts || [];
    if (requiredCohorts.length > 0) {
      const hasAccess = requiredCohorts.some((cohort) => userCohorts.includes(cohort));
      if (!hasAccess) return 'availability';
    }
  }

  return calendarConfig.access as 'full' | 'availability';
}
