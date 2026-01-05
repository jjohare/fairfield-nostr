/**
 * Configuration Types
 * Type definitions for YAML-based 3-tier BBS configuration
 * Hierarchy: Category → Section → Forum (NIP-28 Channel)
 */

export type RoleId = 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';
export type CohortId = string;
export type CategoryId = string;
export type SectionId = string;
export type ForumId = string;
export type CalendarAccessLevel = 'full' | 'availability' | 'cohort' | 'none';
export type ChannelVisibility = 'public' | 'cohort' | 'invite';

export interface RoleCapability {
	id: string;
	description?: string;
}

export interface RoleConfig {
	id: RoleId;
	name: string;
	level: number;
	description: string;
	capabilities?: string[];
}

export interface CohortConfig {
	id: CohortId;
	name: string;
	description: string;
}

export interface AccessConfig {
	requiresApproval: boolean;
	defaultRole: RoleId;
	autoApprove?: boolean;
	requiredCohorts?: CohortId[];
}

export interface CalendarConfig {
	access: CalendarAccessLevel;
	canCreate: boolean;
	cohortRestricted?: boolean;
}

export interface UIConfig {
	color: string;
}

/**
 * Tier configuration for naming flexibility
 */
export interface TierConfig {
	level: number;
	name: string;
	plural: string;
}

/**
 * Forum (Tier 3) - Maps to NIP-28 Channel
 * Forums are dynamically populated from Nostr events
 */
export interface ForumConfig {
	id: ForumId;
	name: string;
	description: string;
	icon?: string;
	order: number;
	pinned?: boolean;
	locked?: boolean;
}

/**
 * Section (Tier 2) - Container for Forums
 */
export interface SectionConfig {
	id: SectionId;
	name: string;
	description: string;
	icon: string;
	order: number;
	access: AccessConfig;
	calendar: CalendarConfig;
	ui: UIConfig;
	allowForumCreation?: boolean;
	showStats?: boolean;
}

/**
 * Category (Tier 1) - Top-level container
 */
export interface CategoryConfig {
	id: CategoryId;
	name: string;
	description: string;
	icon: string;
	order: number;
	sections: SectionConfig[];
	ui?: UIConfig;
}

export interface CalendarAccessLevelConfig {
	id: CalendarAccessLevel;
	name: string;
	description: string;
	canView: boolean;
	canViewDetails: boolean | 'cohort-match';
}

export interface ChannelVisibilityConfig {
	id: ChannelVisibility;
	name: string;
	description: string;
}

export interface AppConfig {
	name: string;
	version: string;
	defaultPath: string; // e.g., '/general/public-lobby'
	tiers?: TierConfig[];
}

export interface SuperuserConfig {
	pubkey: string;
	name: string;
	relayUrl?: string;
}

export interface DeploymentConfig {
	relayUrl?: string;
	embeddingApiUrl?: string;
	gcsEmbeddingsUrl?: string;
	frontendUrl?: string;
}

export interface BBSConfig {
	app: AppConfig;
	superuser?: SuperuserConfig;
	deployment?: DeploymentConfig;
	roles: RoleConfig[];
	cohorts: CohortConfig[];
	categories: CategoryConfig[];
	calendarAccessLevels: CalendarAccessLevelConfig[];
	channelVisibility: ChannelVisibilityConfig[];
}

// Alias for backward compatibility during migration
export type SectionsConfig = BBSConfig;

/**
 * Breadcrumb navigation item
 */
export interface BreadcrumbItem {
	label: string;
	path: string;
	icon?: string;
}

/**
 * User's role assignment for a section
 */
export interface UserSectionRole {
	sectionId: SectionId;
	role: RoleId;
	assignedAt: number;
	assignedBy?: string;
}

/**
 * User's complete permission state
 */
export interface UserPermissions {
	pubkey: string;
	cohorts: CohortId[];
	globalRole: RoleId;
	sectionRoles: UserSectionRole[];
}
