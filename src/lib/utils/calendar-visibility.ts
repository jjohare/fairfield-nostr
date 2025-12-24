/**
 * Calendar Visibility Utilities
 * Implements permission-based event visibility with progressive disclosure
 */

import type { UserPermissions, SectionId, CohortId, RoleId } from '$lib/config/types';
import { canAccessSection, canCreateCalendarEvent } from '$lib/config/permissions';
import type {
	FairfieldEvent,
	EventCategory,
	EventVenueType,
	EventStatus,
	VisibilityLayer
} from '$lib/types/calendar';

// Re-export types for convenience
export type { VisibilityLayer, EventCategory, EventStatus, FairfieldEvent };
export type VenueType = EventVenueType;

/**
 * Event visibility rules for internal use
 */
export interface EventVisibilityRules {
	// Who can see this event exists (Layer 2+)
	visibleTo: {
		sections: SectionId[];
		cohorts: CohortId[];
		roles: RoleId[];
		specificUsers: string[];
	};

	// Who can see full details (Layer 4)
	detailsVisibleTo: {
		sections: SectionId[];
		cohorts: CohortId[];
		roles: RoleId[];
		specificUsers: string[];
	};

	// Who can RSVP
	rsvpAllowedFor: {
		cohorts: CohortId[];
		roles: RoleId[];
	};
}

/**
 * Internal event display structure for visibility functions
 * Compatible with FairfieldEvent from types/calendar.ts
 */
export interface CalendarDisplayEvent {
	id: string;
	title?: string;
	name?: string;
	description?: string;
	start: number;
	end: number;

	// Section association
	sectionId?: SectionId;
	linkedResources?: {
		channelId?: string;
	};

	// Venue - supports both flat and nested structures
	venue?: {
		type: EventVenueType;
		room?: string;
		address?: string;
		coordinates?: [number, number];
		virtualLink?: string;
	};

	// Category - supports both string and object
	category?: EventCategory | {
		primary: EventCategory;
		tags?: string[];
		isPublicListing?: boolean;
	};

	tags?: string[];

	// Visibility
	visibility?: EventVisibilityRules | {
		visibleToSections?: SectionId[];
		visibleToCohorts?: CohortId[];
		visibleToRoles?: RoleId[];
		detailsVisibleToSections?: SectionId[];
		detailsVisibleToCohorts?: CohortId[];
		specificUsers?: string[];
	};

	// Attendance
	attendance?: {
		maxCapacity?: number;
		currentCount: number;
		waitlistEnabled?: boolean;
		requiresApproval?: boolean;
		ticketPrice?: number;
	};

	// Status
	status?: EventStatus;

	// Creator
	createdBy?: string;
}

/**
 * Helper to normalize visibility structure
 */
function normalizeVisibility(event: CalendarDisplayEvent): EventVisibilityRules | null {
	if (!event.visibility) return null;

	// Check if it's already in the normalized format
	if ('visibleTo' in event.visibility && 'detailsVisibleTo' in event.visibility) {
		return event.visibility as EventVisibilityRules;
	}

	// Convert from FairfieldEvent visibility format
	const vis = event.visibility as {
		visibleToSections?: SectionId[];
		visibleToCohorts?: CohortId[];
		visibleToRoles?: RoleId[];
		detailsVisibleToSections?: SectionId[];
		detailsVisibleToCohorts?: CohortId[];
		specificUsers?: string[];
	};

	return {
		visibleTo: {
			sections: vis.visibleToSections || [],
			cohorts: vis.visibleToCohorts || [],
			roles: vis.visibleToRoles || [],
			specificUsers: vis.specificUsers || []
		},
		detailsVisibleTo: {
			sections: vis.detailsVisibleToSections || [],
			cohorts: vis.detailsVisibleToCohorts || [],
			roles: [],
			specificUsers: vis.specificUsers || []
		},
		rsvpAllowedFor: {
			cohorts: vis.visibleToCohorts || [],
			roles: vis.visibleToRoles || []
		}
	};
}

/**
 * Helper to get section ID from event
 */
function getEventSectionId(event: CalendarDisplayEvent): SectionId | undefined {
	if (event.sectionId) return event.sectionId;
	if (event.linkedResources?.channelId) {
		// Extract section from channel ID if possible
		return event.linkedResources.channelId.split('/')[0] as SectionId;
	}
	return undefined;
}

/**
 * Get event visibility layer for a user
 * Returns the highest level of detail the user can see
 */
export function getEventVisibilityLayer(
	event: CalendarDisplayEvent,
	userPermissions: UserPermissions
): VisibilityLayer {
	// Global admin sees everything
	if (userPermissions.globalRole === 'admin') {
		return 'full';
	}

	const visibility = normalizeVisibility(event);
	const sectionId = getEventSectionId(event);

	// If no visibility rules, default to full for now
	if (!visibility) {
		return 'full';
	}

	// Check if user's pubkey is specifically allowed full access
	if (visibility.detailsVisibleTo.specificUsers.includes(userPermissions.pubkey)) {
		return 'full';
	}

	// Check if user's pubkey is specifically allowed to see the event
	const isSpecificallyVisible = visibility.visibleTo.specificUsers.includes(userPermissions.pubkey);

	// Check cohort match for full details
	const hasDetailsCohort = visibility.detailsVisibleTo.cohorts.some(cohort =>
		userPermissions.cohorts.includes(cohort)
	);

	// Check role match for full details
	const hasDetailsRole = visibility.detailsVisibleTo.roles.some(role =>
		role === userPermissions.globalRole ||
		userPermissions.sectionRoles.some(sr => sr.role === role)
	);

	// Check section match for full details
	const hasDetailsSection = visibility.detailsVisibleTo.sections.some(sid => {
		// User must have access to section
		if (!canAccessSection(userPermissions, sid)) {
			return false;
		}
		// Check if event's section matches
		return sectionId ? sid === sectionId : true;
	});

	// Full access if matches any details criteria
	if (hasDetailsCohort || hasDetailsRole || hasDetailsSection || isSpecificallyVisible) {
		return 'full';
	}

	// Check cohort match for basic visibility
	const hasVisibleCohort = visibility.visibleTo.cohorts.some(cohort =>
		userPermissions.cohorts.includes(cohort)
	);

	// Check role match for basic visibility
	const hasVisibleRole = visibility.visibleTo.roles.some(role =>
		role === userPermissions.globalRole ||
		userPermissions.sectionRoles.some(sr => sr.role === role)
	);

	// Check section match for basic visibility
	const hasVisibleSection = visibility.visibleTo.sections.some(sid =>
		canAccessSection(userPermissions, sid)
	);

	// Type-level access if matches any visibility criteria
	if (hasVisibleCohort || hasVisibleRole || hasVisibleSection) {
		return 'type';
	}

	// Busy slot if user can access the section but not this specific event
	if (sectionId && canAccessSection(userPermissions, sectionId)) {
		return 'busy';
	}

	// Hidden otherwise
	return 'hidden';
}

/**
 * Check if user can RSVP to an event
 */
export function canUserRSVP(
	event: CalendarDisplayEvent,
	userPermissions: UserPermissions
): boolean {
	// Can't RSVP if event is cancelled or draft
	if (event.status && event.status !== 'published') {
		return false;
	}

	// Must have at least 'type' level visibility
	const layer = getEventVisibilityLayer(event, userPermissions);
	if (layer === 'hidden' || layer === 'busy') {
		return false;
	}

	// Check capacity
	if (event.attendance?.maxCapacity !== undefined) {
		if (event.attendance.currentCount >= event.attendance.maxCapacity) {
			// Could still join waitlist if enabled
			return event.attendance.waitlistEnabled ?? false;
		}
	}

	const visibility = normalizeVisibility(event);
	if (!visibility) {
		return true; // No restrictions
	}

	// Check if user's cohort is allowed to RSVP
	const hasCohortAccess = visibility.rsvpAllowedFor.cohorts.some(cohort =>
		userPermissions.cohorts.includes(cohort)
	);

	// Check if user's role is allowed to RSVP
	const hasRoleAccess = visibility.rsvpAllowedFor.roles.some(role =>
		role === userPermissions.globalRole ||
		userPermissions.sectionRoles.some(sr => sr.role === role)
	);

	// Allow RSVP if cohorts or roles list is empty (no restrictions)
	const noRestrictions =
		visibility.rsvpAllowedFor.cohorts.length === 0 &&
		visibility.rsvpAllowedFor.roles.length === 0;

	return noRestrictions || hasCohortAccess || hasRoleAccess;
}

/**
 * Check if user can create events in a section
 */
export function canUserCreateEvent(
	sectionId: SectionId,
	userPermissions: UserPermissions
): boolean {
	return canCreateCalendarEvent(userPermissions, sectionId);
}

/**
 * Filter events to only those visible to the user
 */
export function filterEventsForUser<T extends CalendarDisplayEvent>(
	events: T[],
	userPermissions: UserPermissions
): T[] {
	return events.filter(event => {
		const layer = getEventVisibilityLayer(event, userPermissions);
		return layer !== 'hidden';
	});
}

/**
 * Get visible event details based on visibility layer
 * Returns partial event object with only the allowed fields
 */
export function getVisibleEventDetails(
	event: CalendarDisplayEvent,
	layer: VisibilityLayer
): Partial<CalendarDisplayEvent> | null {
	switch (layer) {
		case 'hidden':
			return null;

		case 'busy':
			// Only show time block
			return {
				id: event.id,
				start: event.start,
				end: event.end
			};

		case 'type':
			// Show type, time, category, venue type, status
			return {
				id: event.id,
				start: event.start,
				end: event.end,
				category: event.category,
				venue: event.venue ? {
					type: event.venue.type
				} : undefined,
				status: event.status,
				sectionId: event.sectionId
			};

		case 'full':
			// Return everything
			return event;

		default:
			return null;
	}
}

/**
 * Helper to get primary category from category field
 */
function getPrimaryCategory(category: EventCategory | { primary: EventCategory } | undefined): EventCategory | undefined {
	if (!category) return undefined;
	if (typeof category === 'string') return category;
	return category.primary;
}

/**
 * Get emoji icon for event category
 */
export function getCategoryIcon(category: EventCategory | { primary: EventCategory } | undefined): string {
	const cat = getPrimaryCategory(category);
	if (!cat) return '📅';

	const icons: Record<string, string> = {
		// Venue events (support both hyphen and underscore)
		'workshop': '🔧',
		'seminar': '📚',
		'social': '🥳',
		'ceremony': '🌸',
		'retreat': '🧘',
		'work-session': '💼',
		'work_session': '💼',
		'maintenance': '🛠️',
		'accommodation': '🛏️',

		// Offsite events
		'club-night': '🎵',
		'club_night': '🎵',
		'festival': '🎪',
		'market': '🛍️',
		'nature': '🌲',
		'exhibition': '🎨',
		'meetup': '🤝',

		// Online events
		'webinar': '🎓',
		'call': '📞',
		'stream': '📺',
		'planning': '📋'
	};

	return icons[cat] || '📅';
}

/**
 * Get color for event category
 */
export function getCategoryColor(category: EventCategory | { primary: EventCategory } | undefined): string {
	const cat = getPrimaryCategory(category);
	if (!cat) return '#6b7280';

	const colors: Record<string, string> = {
		// Venue events (support both hyphen and underscore)
		'workshop': '#10b981',
		'seminar': '#3b82f6',
		'social': '#f59e0b',
		'ceremony': '#8b5cf6',
		'retreat': '#ec4899',
		'work-session': '#6b7280',
		'work_session': '#6b7280',
		'maintenance': '#78716c',
		'accommodation': '#14b8a6',

		// Offsite events
		'club-night': '#a855f7',
		'club_night': '#a855f7',
		'festival': '#ef4444',
		'market': '#f97316',
		'nature': '#22c55e',
		'exhibition': '#ec4899',
		'meetup': '#06b6d4',

		// Online events
		'webinar': '#6366f1',
		'call': '#8b5cf6',
		'stream': '#d946ef',
		'planning': '#64748b'
	};

	return colors[cat] || '#6b7280';
}

/**
 * Get venue type icon
 */
export function getVenueTypeIcon(venueType: EventVenueType | undefined): string {
	if (!venueType) return '📍';

	const icons: Record<EventVenueType, string> = {
		fairfield: '🏠',
		offsite: '📍',
		online: '💻',
		external: '🌍'
	};

	return icons[venueType] || '📍';
}

/**
 * Check if event is at capacity
 */
export function isEventAtCapacity(event: CalendarDisplayEvent): boolean {
	if (!event.attendance || event.attendance.maxCapacity === undefined) {
		return false;
	}

	return event.attendance.currentCount >= event.attendance.maxCapacity;
}

/**
 * Get spots remaining for an event
 */
export function getSpotsRemaining(event: CalendarDisplayEvent): number | null {
	if (!event.attendance || event.attendance.maxCapacity === undefined) {
		return null;
	}

	return Math.max(0, event.attendance.maxCapacity - event.attendance.currentCount);
}

/**
 * Format event time range
 */
export function formatEventTimeRange(start: number, end: number): string {
	const startDate = new Date(start);
	const endDate = new Date(end);

	const isSameDay =
		startDate.getDate() === endDate.getDate() &&
		startDate.getMonth() === endDate.getMonth() &&
		startDate.getFullYear() === endDate.getFullYear();

	const timeFormat = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit'
	});

	const dateFormat = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short'
	});

	if (isSameDay) {
		return `${dateFormat.format(startDate)} ${timeFormat.format(startDate)} - ${timeFormat.format(endDate)}`;
	} else {
		return `${dateFormat.format(startDate)} ${timeFormat.format(startDate)} - ${dateFormat.format(endDate)} ${timeFormat.format(endDate)}`;
	}
}
