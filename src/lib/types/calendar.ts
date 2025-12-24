/**
 * Calendar Types - Fairfield Event System
 * Extends the base calendar system with comprehensive event categorization,
 * visibility controls, and venue management
 */

import type { SectionId, CohortId, RoleId } from '../config/types';
import type { CalendarEvent } from '../nostr/calendar';

/**
 * Primary event categories
 */
export type EventCategory =
	| 'workshop'
	| 'seminar'
	| 'social'
	| 'ceremony'
	| 'retreat'
	| 'work-session'
	| 'maintenance'
	| 'accommodation'
	| 'club-night'
	| 'festival'
	| 'market'
	| 'nature'
	| 'exhibition'
	| 'meetup'
	| 'webinar'
	| 'call'
	| 'stream'
	| 'planning';

/**
 * Event venue type categorization
 */
export type EventVenueType = 'fairfield' | 'offsite' | 'online' | 'external';

/**
 * Event visibility layer levels
 * - hidden: Event not visible at all
 * - busy: Time slot shown as blocked, no details
 * - type: Event category and duration visible
 * - full: Complete event details visible
 */
export type VisibilityLayer = 'hidden' | 'busy' | 'type' | 'full';

/**
 * Calendar view modes
 */
export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

/**
 * Event recurrence pattern
 */
export type RecurrencePattern = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

/**
 * Event publication status
 */
export type EventStatus = 'draft' | 'published' | 'cancelled';

/**
 * Event visibility control rules
 * Determines who can see the event and at what detail level
 */
export interface EventVisibility {
	/**
	 * Sections where event is visible (Layer 2+)
	 */
	visibleToSections: SectionId[];

	/**
	 * Cohorts that can see event exists (Layer 2+)
	 */
	visibleToCohorts: CohortId[];

	/**
	 * Roles that can see event exists (Layer 2+)
	 */
	visibleToRoles: RoleId[];

	/**
	 * Sections with full detail access (Layer 4)
	 */
	detailsVisibleToSections: SectionId[];

	/**
	 * Cohorts with full detail access (Layer 4)
	 */
	detailsVisibleToCohorts: CohortId[];

	/**
	 * Specific user pubkeys with access
	 */
	specificUsers?: string[];

	/**
	 * Public listing flag
	 */
	isPublicListing?: boolean;
}

/**
 * Event venue and location information
 */
export interface EventVenue {
	/**
	 * Venue type
	 */
	type: EventVenueType;

	/**
	 * Specific room or area (for Fairfield events)
	 */
	room?: string;

	/**
	 * Full address (for offsite events)
	 */
	address?: string;

	/**
	 * Geographical coordinates [latitude, longitude]
	 */
	coordinates?: [number, number];

	/**
	 * Virtual meeting link (for online events)
	 */
	virtualLink?: string;

	/**
	 * Additional location notes
	 */
	notes?: string;
}

/**
 * Event category information
 */
export interface EventCategoryInfo {
	/**
	 * Primary category
	 */
	primary: EventCategory;

	/**
	 * Additional tags for filtering
	 */
	tags: string[];

	/**
	 * Display in public event feed
	 */
	isPublicListing: boolean;

	/**
	 * Optional icon override
	 */
	icon?: string;
}

/**
 * Attendance tracking and capacity management
 */
export interface EventAttendance {
	/**
	 * Maximum number of attendees (undefined = unlimited)
	 */
	maxCapacity?: number;

	/**
	 * Current RSVP count
	 */
	currentCount: number;

	/**
	 * Enable waitlist when full
	 */
	waitlistEnabled: boolean;

	/**
	 * Require host approval for RSVPs
	 */
	requiresApproval: boolean;

	/**
	 * Ticket price (0 = free, undefined = not ticketed)
	 */
	ticketPrice?: number;

	/**
	 * Number on waitlist
	 */
	waitlistCount?: number;
}

/**
 * Event recurrence configuration
 */
export interface EventRecurrence {
	/**
	 * Recurrence pattern
	 */
	pattern: RecurrencePattern;

	/**
	 * Recurrence interval (e.g., every 2 weeks)
	 */
	interval?: number;

	/**
	 * End date for recurrence (undefined = no end)
	 */
	endDate?: number;

	/**
	 * Specific dates to skip (Unix timestamps)
	 */
	exceptions: number[];

	/**
	 * Days of week for weekly recurrence (0=Sunday, 6=Saturday)
	 */
	daysOfWeek?: number[];
}

/**
 * Linked resources for an event
 */
export interface EventLinks {
	/**
	 * Linked chatroom for event discussion
	 */
	chatRoomId?: string;

	/**
	 * Parent channel for access control
	 */
	channelId: string;

	/**
	 * External links (websites, tickets, etc.)
	 */
	externalLinks: string[];

	/**
	 * Attached document references
	 */
	documents: string[];

	/**
	 * Related event IDs
	 */
	relatedEvents?: string[];
}

/**
 * Event metadata
 */
export interface EventMetadata {
	/**
	 * Creation timestamp
	 */
	createdAt: number;

	/**
	 * Last update timestamp
	 */
	updatedAt: number;

	/**
	 * Creator pubkey
	 */
	createdBy: string;

	/**
	 * Last editor pubkey
	 */
	lastModifiedBy: string;

	/**
	 * Publication status
	 */
	status: EventStatus;

	/**
	 * Version number
	 */
	version?: number;

	/**
	 * Deletion timestamp (if soft-deleted)
	 */
	deletedAt?: number;
}

/**
 * Extended Fairfield Event
 * Extends the base CalendarEvent with comprehensive categorization,
 * visibility controls, and venue management
 */
export interface FairfieldEvent extends CalendarEvent {
	/**
	 * Venue and location information
	 */
	venue: EventVenue;

	/**
	 * Event categorization
	 */
	category: EventCategoryInfo;

	/**
	 * Visibility rules
	 */
	visibility: EventVisibility;

	/**
	 * Attendance tracking
	 */
	attendance: EventAttendance;

	/**
	 * Event status
	 */
	status: EventStatus;

	/**
	 * Recurrence configuration
	 */
	recurrence?: EventRecurrence;

	/**
	 * Linked resources
	 */
	linkedResources: EventLinks;

	/**
	 * Event metadata
	 */
	meta: EventMetadata;
}

/**
 * Event type template configuration
 * Provides defaults for different event categories
 */
export interface EventTypeConfig {
	/**
	 * Template identifier
	 */
	id: EventCategory;

	/**
	 * Display name
	 */
	name: string;

	/**
	 * Icon emoji or identifier
	 */
	icon: string;

	/**
	 * Default event duration in minutes
	 */
	defaultDuration: number;

	/**
	 * Default visibility settings
	 */
	defaultVisibility: {
		sections: SectionId[];
		cohorts: CohortId[];
		roles?: RoleId[];
	};

	/**
	 * Allowed venue types for this event
	 */
	allowedVenues: string[];

	/**
	 * Default capacity
	 */
	defaultCapacity?: number;

	/**
	 * Color scheme for display
	 */
	color?: string;

	/**
	 * Description template
	 */
	descriptionTemplate?: string;

	/**
	 * Required fields for this event type
	 */
	requiredFields?: string[];
}

/**
 * Calendar filter configuration
 */
export interface CalendarFilters {
	/**
	 * Show events from these sections
	 */
	sections: SectionId[];

	/**
	 * Show events from these cohorts
	 */
	cohorts: CohortId[];

	/**
	 * Show events of these categories
	 */
	categories: EventCategory[];

	/**
	 * Show events at these venues
	 */
	venueTypes: EventVenueType[];

	/**
	 * Date range filter
	 */
	dateRange?: {
		start: number;
		end: number;
	};

	/**
	 * Only show events user can RSVP to
	 */
	onlyAvailable?: boolean;

	/**
	 * Search query
	 */
	searchQuery?: string;
}

/**
 * Calendar view configuration
 */
export interface CalendarViewConfig {
	/**
	 * Current view mode
	 */
	mode: CalendarViewMode;

	/**
	 * Currently displayed date
	 */
	currentDate: Date;

	/**
	 * Active filters
	 */
	filters: CalendarFilters;

	/**
	 * Sidebar state
	 */
	sidebarVisible: boolean;

	/**
	 * Preferred timezone
	 */
	timezone?: string;

	/**
	 * Week starts on (0=Sunday, 1=Monday)
	 */
	weekStartsOn?: number;

	/**
	 * Show week numbers
	 */
	showWeekNumbers?: boolean;
}

/**
 * Venue configuration
 */
export interface VenueConfig {
	/**
	 * Venue identifier
	 */
	id: string;

	/**
	 * Display name
	 */
	name: string;

	/**
	 * Maximum capacity
	 */
	capacity?: number;

	/**
	 * Color for calendar display
	 */
	color?: string;

	/**
	 * Description
	 */
	description?: string;

	/**
	 * Address or location
	 */
	address?: string;

	/**
	 * Geographical coordinates
	 */
	coordinates?: [number, number];

	/**
	 * Amenities available
	 */
	amenities?: string[];

	/**
	 * Booking requirements
	 */
	requiresApproval?: boolean;
}

/**
 * Calendar system configuration
 */
export interface CalendarConfig {
	/**
	 * Calendar enabled
	 */
	enabled: boolean;

	/**
	 * Global settings
	 */
	settings: {
		defaultView: CalendarViewMode;
		weekStartsOn: 'sunday' | 'monday';
		timezone: string;
		showWeekNumbers: boolean;
	};

	/**
	 * Available venues
	 */
	venues: {
		[venueId: string]: VenueConfig;
	};

	/**
	 * Event type templates
	 */
	eventTypes: EventTypeConfig[];
}

/**
 * User's event interaction
 */
export interface UserEventInteraction {
	/**
	 * Event ID
	 */
	eventId: string;

	/**
	 * User pubkey
	 */
	userPubkey: string;

	/**
	 * RSVP status
	 */
	rsvpStatus?: 'accept' | 'decline' | 'tentative';

	/**
	 * On waitlist
	 */
	onWaitlist?: boolean;

	/**
	 * Check-in timestamp
	 */
	checkedInAt?: number;

	/**
	 * Feedback/rating
	 */
	rating?: number;

	/**
	 * Notes
	 */
	notes?: string;
}

/**
 * Event analytics data
 */
export interface EventAnalytics {
	/**
	 * Event ID
	 */
	eventId: string;

	/**
	 * View count
	 */
	views: number;

	/**
	 * RSVP counts by status
	 */
	rsvpCounts: {
		accept: number;
		decline: number;
		tentative: number;
	};

	/**
	 * Actual attendance count
	 */
	attendanceCount?: number;

	/**
	 * Peak concurrent viewers (for online events)
	 */
	peakViewers?: number;

	/**
	 * Average rating
	 */
	averageRating?: number;

	/**
	 * Engagement metrics
	 */
	engagement?: {
		chatMessages?: number;
		shares?: number;
		reactions?: number;
	};
}
