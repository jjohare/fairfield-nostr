/**
 * Birthday Calendar Module
 * Fetches and displays tribe member birthdays on the calendar
 * Only visible to members of the same cohort/tribe
 */

import { ndk, isConnected } from './relay';
import type { NDKFilter } from '@nostr-dev-kit/ndk';
import type { CalendarEvent } from './calendar';
import { verifyCohortMembership, type CohortName } from './whitelist';

export interface BirthdayEntry {
  pubkey: string;
  name: string | null;
  avatar: string | null;
  birthday: string; // YYYY-MM-DD format
  dayMonth: string; // MM-DD format for annual recurrence
}

/**
 * Fetch birthdays for all members of a specific cohort
 */
export async function fetchCohortBirthdays(cohort: CohortName): Promise<BirthdayEntry[]> {
  const ndkInstance = ndk();
  if (!ndkInstance) {
    console.error('NDK not initialized');
    return [];
  }

  try {
    // Fetch kind 0 metadata events that might have birthdays
    // We'll filter by cohort membership after fetching
    const filter: NDKFilter = {
      kinds: [0],
      limit: 500,
    };

    const events = await ndkInstance.fetchEvents(filter);
    const birthdays: BirthdayEntry[] = [];

    for (const event of events) {
      try {
        const metadata = JSON.parse(event.content);
        const birthday = metadata.birthday;

        if (birthday && isValidBirthday(birthday)) {
          // Verify this user is in the cohort
          const isMember = await verifyCohortMembership(event.pubkey, cohort);

          if (isMember) {
            birthdays.push({
              pubkey: event.pubkey,
              name: metadata.display_name || metadata.name || null,
              avatar: metadata.picture || null,
              birthday,
              dayMonth: birthday.slice(5), // MM-DD
            });
          }
        }
      } catch (e) {
        // Skip events with invalid JSON
      }
    }

    return birthdays;
  } catch (error) {
    console.error('Failed to fetch cohort birthdays:', error);
    return [];
  }
}

/**
 * Convert birthdays to calendar events for a specific year
 */
export function birthdaysToCalendarEvents(
  birthdays: BirthdayEntry[],
  year: number = new Date().getFullYear()
): CalendarEvent[] {
  return birthdays.map(entry => {
    const [month, day] = entry.dayMonth.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const startTs = Math.floor(eventDate.getTime() / 1000);
    const endTs = startTs + 86400 - 1; // End of day

    return {
      id: `birthday-${entry.pubkey}-${year}`,
      title: `${entry.name || 'Member'}'s Birthday`,
      description: `Happy birthday to ${entry.name || 'a tribe member'}!`,
      start: startTs,
      end: endTs,
      channelId: 'birthdays',
      createdBy: entry.pubkey,
      tags: ['birthday'],
    };
  });
}

/**
 * Fetch birthday calendar events for current user's tribe
 * Returns empty array if user is not in members
 */
export async function fetchTribeBirthdayEvents(
  userPubkey: string
): Promise<CalendarEvent[]> {
  const tribeCohort: CohortName = 'members';

  // Check if current user is a tribe member
  const isTribeMember = await verifyCohortMembership(userPubkey, tribeCohort);

  if (!isTribeMember) {
    return []; // Non-members don't see birthdays
  }

  const birthdays = await fetchCohortBirthdays(tribeCohort);
  const currentYear = new Date().getFullYear();

  // Generate events for current year and next year (for upcoming birthdays)
  const currentYearEvents = birthdaysToCalendarEvents(birthdays, currentYear);
  const nextYearEvents = birthdaysToCalendarEvents(birthdays, currentYear + 1);

  return [...currentYearEvents, ...nextYearEvents];
}

/**
 * Validate birthday format (YYYY-MM-DD)
 */
function isValidBirthday(birthday: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return false;
  }

  const [year, month, day] = birthday.split('-').map(Number);

  // Basic validation
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;

  return true;
}

/**
 * Get upcoming birthdays within N days
 */
export async function getUpcomingBirthdays(
  userPubkey: string,
  days: number = 30
): Promise<BirthdayEntry[]> {
  const tribeCohort: CohortName = 'members';

  // Check if current user is a tribe member
  const isTribeMember = await verifyCohortMembership(userPubkey, tribeCohort);

  if (!isTribeMember) {
    return [];
  }

  const birthdays = await fetchCohortBirthdays(tribeCohort);
  const now = new Date();
  const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return birthdays.filter(entry => {
    const [month, day] = entry.dayMonth.split('-').map(Number);

    // Check if birthday falls within the range (considering year wrap)
    const thisYearBirthday = new Date(now.getFullYear(), month - 1, day);
    const nextYearBirthday = new Date(now.getFullYear() + 1, month - 1, day);

    return (
      (thisYearBirthday >= now && thisYearBirthday <= targetDate) ||
      (nextYearBirthday >= now && nextYearBirthday <= targetDate)
    );
  });
}
