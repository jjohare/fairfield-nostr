/**
 * Calendar Access Utility
 * Provides access control logic for calendar events based on section membership
 */

import type { ChannelSection, CalendarAccessLevel } from '$lib/types/channel';
import { getSection } from '$lib/config';

/**
 * Calendar event interface for access filtering
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  channelId: string;
  chatRoomId?: string;
  description: string;
  location?: string;
  createdBy: string;
  maxAttendees?: number;
  tags?: string[];
}

/**
 * Filtered calendar event with access level
 */
export interface FilteredCalendarEvent extends CalendarEvent {
  accessLevel: 'full' | 'availability-only' | 'hidden';
}

/**
 * Get the calendar access level for a section from configuration
 */
export function getCalendarAccessLevel(section: ChannelSection): CalendarAccessLevel {
  const sectionConfig = getSection(section);
  return sectionConfig?.calendar?.access || 'none';
}

/**
 * Check if user can view calendar event based on their section memberships
 *
 * Access rules:
 * - public-lobby: full access to all events
 * - community-rooms: full access to all events
 * - dreamlab: availability-only access (can see dates booked, not details)
 */
export function canViewCalendarEvent(
  userSections: ChannelSection[],
  eventCohortTag?: string
): boolean {
  // Users with public-lobby or community-rooms have full access
  const hasFullAccess = userSections.some(section =>
    section === 'public-lobby' || section === 'community-rooms'
  );

  return hasFullAccess;
}

/**
 * Check if user can view event details (not just availability)
 *
 * For dreamlab users:
 * - Only returns true if event has cohort tag matching user's cohorts
 *
 * For users with full access sections:
 * - Always returns true
 */
export function canViewEventDetails(
  userSections: ChannelSection[],
  eventCohortTag?: string,
  userCohorts: string[] = []
): boolean {
  // Users with full access sections always see details
  const hasFullAccess = userSections.some(section =>
    getCalendarAccessLevel(section) === 'full'
  );

  if (hasFullAccess) {
    return true;
  }

  // DreamLab users need cohort match to see details
  const hasDreamLabAccess = userSections.includes('dreamlab');

  if (hasDreamLabAccess && eventCohortTag) {
    return userCohorts.includes(eventCohortTag);
  }

  return false;
}

/**
 * Filter calendar events based on user's section memberships and cohorts
 *
 * Returns events with access level:
 * - 'full': User can see all event details
 * - 'availability-only': User can only see that dates are booked
 * - 'hidden': Event should not be shown to user
 */
export function filterCalendarEvents(
  events: CalendarEvent[],
  userSections: ChannelSection[],
  userCohorts: string[] = []
): FilteredCalendarEvent[] {
  return events.map(event => {
    // Extract cohort tag from event's channelId or tags
    const eventCohortTag = event.channelId || event.tags?.[0];

    // Determine access level
    let accessLevel: 'full' | 'availability-only' | 'hidden';

    // Check if user has full access (public-lobby or community-rooms)
    const hasFullAccess = userSections.some(section =>
      getCalendarAccessLevel(section) === 'full'
    );

    if (hasFullAccess) {
      accessLevel = 'full';
    } else {
      // Check DreamLab access
      const hasDreamLabAccess = userSections.includes('dreamlab');

      if (hasDreamLabAccess) {
        // DreamLab users can see details if cohort matches, otherwise availability only
        const canSeeDetails = eventCohortTag && userCohorts.includes(eventCohortTag);
        accessLevel = canSeeDetails ? 'full' : 'availability-only';
      } else {
        // No access to any sections - hide event
        accessLevel = 'hidden';
      }
    }

    return {
      ...event,
      accessLevel
    };
  });
}
