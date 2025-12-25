/**
 * Configuration Module
 * Central export for 3-tier BBS configuration
 * Hierarchy: Category → Section → Forum (NIP-28 Channel)
 */

// Environment config (relay URL, admin pubkey, etc.)
export {
	RELAY_URL,
	ADMIN_PUBKEY,
	APP_NAME,
	APP_VERSION,
	NDK_CONFIG,
	TIMEOUTS,
	validateConfig
} from './environment';

// Types
export type {
	RoleId,
	CohortId,
	CategoryId,
	SectionId,
	ForumId,
	CalendarAccessLevel,
	ChannelVisibility,
	TierConfig,
	RoleConfig,
	CohortConfig,
	CategoryConfig,
	SectionConfig,
	ForumConfig,
	AccessConfig,
	CalendarConfig,
	UIConfig,
	CalendarAccessLevelConfig,
	ChannelVisibilityConfig,
	AppConfig,
	SuperuserConfig,
	BBSConfig,
	SectionsConfig,
	UserSectionRole,
	UserPermissions
} from './types';

// Loader functions
export {
	loadConfig,
	saveConfig,
	clearConfigCache,
	// App config
	getAppConfig,
	getTiers,
	getDefaultPath,
	// Categories (Tier 1)
	getCategories,
	getCategory,
	getDefaultCategory,
	// Sections (Tier 2)
	getSections,
	getSectionsByCategory,
	getSection,
	getSectionWithCategory,
	getDefaultSection,
	getSectionsByAccess,
	// Roles
	getRoles,
	getRole,
	roleHasCapability,
	roleIsHigherThan,
	getHighestRole,
	// Cohorts
	getCohorts,
	getCohort,
	// Calendar
	getCalendarAccessLevel,
	// Superuser
	getSuperuser,
	isSuperuser,
	// Navigation
	getBreadcrumbs,
	getCategoryPath,
	getSectionPath,
	getForumPath,
	// Legacy compatibility
	getSectionConfigMap,
	SECTION_CONFIG
} from './loader';

// Export type for breadcrumbs
export type { BreadcrumbItem } from './types';

// Re-export SectionId as ChannelSection for backward compatibility
export type { SectionId as ChannelSection } from './types';

// Permission functions
export {
	hasCapability,
	canAccessSection,
	getEffectiveRole,
	canManageSection,
	canModerateSection,
	canCreateChannel,
	canViewCalendar,
	canViewCalendarDetails,
	canCreateCalendarEvent,
	isGlobalAdmin,
	isSectionAdmin,
	getAccessibleSections,
	getManageableSections,
	createDefaultPermissions,
	createAdminPermissions,
	addSectionRole,
	removeSectionRole,
	addCohort,
	removeCohort
} from './permissions';
