/**
 * Calendar Events Module (NIP-52)
 * Provides utilities for creating and managing calendar events on Nostr
 */

import { ndk, connectNDK } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';

// Calendar event kind (NIP-52 time-based calendar event)
export const CALENDAR_EVENT_KIND = 31923;
// RSVP kind
export const RSVP_KIND = 31925;

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: number; // Unix timestamp
  end: number; // Unix timestamp
  location?: string;
  channelId: string; // For cohort-based access
  createdBy: string;
  maxAttendees?: number;
  tags?: string[];
}

export interface EventRSVP {
  eventId: string;
  pubkey: string;
  status: 'accept' | 'decline' | 'tentative';
  timestamp: number;
}

export interface CreateEventParams {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  channelId: string;
  maxAttendees?: number;
  tags?: string[];
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  params: CreateEventParams
): Promise<CalendarEvent | null> {
  const event = {
    title: params.title,
    description: params.description,
    start: Math.floor(params.start.getTime() / 1000),
    end: Math.floor(params.end.getTime() / 1000),
    location: params.location,
    channelId: params.channelId,
    maxAttendees: params.maxAttendees,
    tags: params.tags,
  };

  if (!ndk?.signer) {
    console.error('NDK not connected or no signer available');
    return null;
  }

  await connectNDK();

  try {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = CALENDAR_EVENT_KIND;

    // Build content as JSON
    const content = JSON.stringify({
      title: event.title,
      description: event.description,
      location: event.location,
      maxAttendees: event.maxAttendees,
    });

    ndkEvent.content = content;

    // Add tags per NIP-52
    ndkEvent.tags = [
      ['d', `${event.start}-${event.channelId}`], // Unique identifier
      ['name', event.title],
      ['start', event.start.toString()],
      ['end', event.end.toString()],
      ['e', event.channelId, '', 'channel'], // Link to channel for cohort gating
    ];

    if (event.location) {
      ndkEvent.tags.push(['location', event.location]);
    }

    if (event.tags) {
      event.tags.forEach((tag) => ndkEvent.tags.push(['t', tag]));
    }

    await ndkEvent.sign();
    await ndkEvent.publish();

    return {
      id: ndkEvent.id,
      title: event.title,
      description: event.description,
      start: event.start,
      end: event.end,
      location: event.location,
      channelId: event.channelId,
      createdBy: ndkEvent.pubkey,
      maxAttendees: event.maxAttendees,
      tags: event.tags,
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return null;
  }
}

/**
 * Fetch calendar events for a specific channel
 */
export async function fetchChannelEvents(channelId: string): Promise<CalendarEvent[]> {
  if (!ndk) {
    console.error('NDK not initialized');
    return [];
  }

  await connectNDK();

  try {
    const filter: NDKFilter = {
      kinds: [CALENDAR_EVENT_KIND],
      '#e': [channelId],
    };

    const events = await ndk.fetchEvents(filter);
    return Array.from(events).map(parseCalendarEvent).filter(Boolean) as CalendarEvent[];
  } catch (error) {
    console.error('Failed to fetch channel events:', error);
    return [];
  }
}

/**
 * Fetch all calendar events across all channels
 */
export async function fetchAllEvents(): Promise<CalendarEvent[]> {
  if (!ndk) {
    console.error('NDK not initialized');
    return [];
  }

  await connectNDK();

  try {
    const filter: NDKFilter = {
      kinds: [CALENDAR_EVENT_KIND],
      limit: 500,
    };

    const events = await ndk.fetchEvents(filter);
    return Array.from(events)
      .map(parseCalendarEvent)
      .filter(Boolean)
      .sort((a, b) => (a as CalendarEvent).start - (b as CalendarEvent).start) as CalendarEvent[];
  } catch (error) {
    console.error('Failed to fetch all events:', error);
    return [];
  }
}

/**
 * Fetch upcoming events (within next N days)
 */
export async function fetchUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
  if (!ndk) {
    console.error('NDK not initialized');
    return [];
  }

  await connectNDK();

  const now = Math.floor(Date.now() / 1000);
  const futureLimit = now + days * 24 * 60 * 60;

  try {
    const filter: NDKFilter = {
      kinds: [CALENDAR_EVENT_KIND],
      since: now - 86400, // Include events from yesterday (might still be ongoing)
      limit: 100,
    };

    const events = await ndk.fetchEvents(filter);
    return Array.from(events)
      .map(parseCalendarEvent)
      .filter((e): e is CalendarEvent => e !== null && e.start <= futureLimit && e.end >= now)
      .sort((a, b) => a.start - b.start);
  } catch (error) {
    console.error('Failed to fetch upcoming events:', error);
    return [];
  }
}

/**
 * RSVP to an event
 */
export async function rsvpToEvent(
  eventId: string,
  status: 'accept' | 'decline' | 'tentative'
): Promise<boolean> {
  if (!ndk?.signer) {
    console.error('NDK not connected or no signer available');
    return false;
  }

  await connectNDK();

  try {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = RSVP_KIND;
    ndkEvent.content = '';
    ndkEvent.tags = [
      ['e', eventId, '', 'event'],
      ['status', status],
      ['d', eventId], // For replaceable event
    ];

    await ndkEvent.sign();
    await ndkEvent.publish();
    return true;
  } catch (error) {
    console.error('Failed to RSVP to event:', error);
    return false;
  }
}

/**
 * Fetch RSVPs for an event
 */
export async function fetchEventRSVPs(eventId: string): Promise<EventRSVP[]> {
  if (!ndk) {
    console.error('NDK not initialized');
    return [];
  }

  await connectNDK();

  try {
    const filter: NDKFilter = {
      kinds: [RSVP_KIND],
      '#e': [eventId],
    };

    const events = await ndk.fetchEvents(filter);
    return Array.from(events)
      .map((e) => {
        const statusTag = e.tags.find((t) => t[0] === 'status');
        const status = statusTag?.[1] as 'accept' | 'decline' | 'tentative';
        if (!status) return null;

        return {
          eventId,
          pubkey: e.pubkey,
          status,
          timestamp: e.created_at || 0,
        };
      })
      .filter(Boolean) as EventRSVP[];
  } catch (error) {
    console.error('Failed to fetch RSVPs:', error);
    return [];
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  if (!ndk?.signer) {
    console.error('NDK not connected or no signer available');
    return false;
  }

  await connectNDK();

  try {
    // Create deletion event (kind 5)
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 5;
    ndkEvent.content = 'Event deleted';
    ndkEvent.tags = [['e', eventId]];

    await ndkEvent.sign();
    await ndkEvent.publish();
    return true;
  } catch (error) {
    console.error('Failed to delete event:', error);
    return false;
  }
}

/**
 * Parse an NDK event into a CalendarEvent
 */
function parseCalendarEvent(event: NDKEvent): CalendarEvent | null {
  try {
    const nameTag = event.tags.find((t) => t[0] === 'name');
    const startTag = event.tags.find((t) => t[0] === 'start');
    const endTag = event.tags.find((t) => t[0] === 'end');
    const channelTag = event.tags.find((t) => t[0] === 'e' && t[3] === 'channel');
    const locationTag = event.tags.find((t) => t[0] === 'location');

    if (!nameTag || !startTag) return null;

    let parsedContent: { description?: string; maxAttendees?: number } = {};
    try {
      parsedContent = JSON.parse(event.content);
    } catch {
      // Content might not be JSON
      parsedContent = { description: event.content };
    }

    return {
      id: event.id,
      title: nameTag[1],
      description: parsedContent.description || '',
      start: parseInt(startTag[1], 10),
      end: endTag ? parseInt(endTag[1], 10) : parseInt(startTag[1], 10),
      location: locationTag?.[1],
      channelId: channelTag?.[1] || '',
      createdBy: event.pubkey,
      maxAttendees: parsedContent.maxAttendees,
      tags: event.tags.filter((t) => t[0] === 't').map((t) => t[1]),
    };
  } catch (error) {
    console.error('Failed to parse calendar event:', error);
    return null;
  }
}
