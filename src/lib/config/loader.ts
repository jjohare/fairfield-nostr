/**
 * Configuration Loader
 * Loads and parses YAML configuration for 3-tier BBS hierarchy
 * Category → Section → Forum (NIP-28 Channel)
 */

import type {
	BBSConfig,
	SectionsConfig,
	CategoryConfig,
	SectionConfig,
	RoleConfig,
	CohortConfig,
	CalendarAccessLevel,
	RoleId,
	CategoryId,
	SectionId,
	CohortId,
	SuperuserConfig,
	TierConfig
} from './types';

import { parse as parseYaml } from 'yaml';
import { browser } from '$app/environment';

// Import default YAML config at build time
import defaultConfigYaml from '../../../config/sections.yaml?raw';

const STORAGE_KEY = 'nostr_bbs_custom_config';

let cachedConfig: BBSConfig | null = null;

/**
 * Load and parse the BBS configuration
 */
export function loadConfig(): BBSConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	// Check for custom config in localStorage
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const customConfig = JSON.parse(stored) as BBSConfig;
				validateConfig(customConfig);
				cachedConfig = customConfig;
				return cachedConfig;
			}
		} catch (error) {
			console.warn('[Config] Invalid stored config, using default:', error);
		}
	}

	// Fall back to default config
	try {
		cachedConfig = parseYaml(defaultConfigYaml) as BBSConfig;
		validateConfig(cachedConfig);
		return cachedConfig;
	} catch (error) {
		console.error('[Config] Failed to parse default config:', error);
		return getDefaultConfig();
	}
}

/**
 * Save custom configuration to localStorage
 */
export function saveConfig(config: BBSConfig): void {
	if (!browser) return;

	try {
		validateConfig(config);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		cachedConfig = config;
	} catch (error) {
		console.error('[Config] Failed to save configuration:', error);
		throw error;
	}
}

/**
 * Clear cached config (forces reload)
 */
export function clearConfigCache(): void {
	cachedConfig = null;
}

/**
 * Validate configuration structure
 */
function validateConfig(config: BBSConfig): void {
	if (!config.app?.name) {
		throw new Error('Missing app.name in configuration');
	}
	if (!config.categories?.length) {
		throw new Error('No categories defined in configuration');
	}
	if (!config.roles?.length) {
		throw new Error('No roles defined in configuration');
	}

	// Validate role references in sections
	const roleIds = new Set(config.roles.map((r) => r.id));
	for (const category of config.categories) {
		for (const section of category.sections) {
			if (!roleIds.has(section.access.defaultRole)) {
				throw new Error(
					`Section ${section.id} references unknown role: ${section.access.defaultRole}`
				);
			}
		}
	}
}

/**
 * Get default configuration (fallback)
 */
function getDefaultConfig(): BBSConfig {
	return {
		app: {
			name: 'Nostr BBS',
			version: '2.0.0',
			defaultPath: '/general/public-lobby',
			tiers: [
				{ level: 1, name: 'Category', plural: 'Categories' },
				{ level: 2, name: 'Section', plural: 'Sections' },
				{ level: 3, name: 'Forum', plural: 'Forums' }
			]
		},
		roles: [
			{ id: 'guest', name: 'Guest', level: 0, description: 'Basic authenticated user' },
			{ id: 'member', name: 'Member', level: 1, description: 'Approved section member' },
			{
				id: 'moderator',
				name: 'Moderator',
				level: 2,
				description: 'Can manage forums and moderate',
				capabilities: ['forum.create', 'message.delete']
			},
			{
				id: 'section-admin',
				name: 'Section Admin',
				level: 3,
				description: 'Section administrator',
				capabilities: ['section.manage', 'member.approve']
			},
			{
				id: 'admin',
				name: 'Admin',
				level: 4,
				description: 'Global administrator',
				capabilities: ['admin.global']
			}
		],
		cohorts: [
			{ id: 'admin', name: 'Administrators', description: 'Global administrators' },
			{ id: 'approved', name: 'Approved Users', description: 'Manually approved' }
		],
		categories: [
			{
				id: 'general',
				name: 'General',
				description: 'Public discussion areas',
				icon: '🏠',
				order: 1,
				sections: [
					{
						id: 'public-lobby',
						name: 'Public Lobby',
						description: 'Welcome area for visitors',
						icon: '👋',
						order: 1,
						access: { requiresApproval: false, defaultRole: 'guest', autoApprove: true },
						calendar: { access: 'full', canCreate: false },
						ui: { color: '#6366f1' },
						showStats: true,
						allowForumCreation: false
					}
				]
			}
		],
		calendarAccessLevels: [
			{ id: 'full', name: 'Full Access', description: 'All details visible', canView: true, canViewDetails: true },
			{ id: 'availability', name: 'Availability Only', description: 'Dates only', canView: true, canViewDetails: false },
			{ id: 'cohort', name: 'Cohort Restricted', description: 'Cohort match required', canView: true, canViewDetails: 'cohort-match' },
			{ id: 'none', name: 'No Access', description: 'Hidden', canView: false, canViewDetails: false }
		],
		channelVisibility: [
			{ id: 'public', name: 'Public', description: 'All section members' },
			{ id: 'cohort', name: 'Cohort Only', description: 'Assigned cohorts' },
			{ id: 'invite', name: 'Invite Only', description: 'Explicit invites' }
		]
	};
}

// Load config once at module level
const config = loadConfig();

// ============================================================================
// APP CONFIG
// ============================================================================

export function getAppConfig() {
	return config.app;
}

export function getTiers(): TierConfig[] {
	return config.app.tiers || [
		{ level: 1, name: 'Category', plural: 'Categories' },
		{ level: 2, name: 'Section', plural: 'Sections' },
		{ level: 3, name: 'Forum', plural: 'Forums' }
	];
}

export function getDefaultPath(): string {
	return config.app.defaultPath || '/general/public-lobby';
}

// ============================================================================
// CATEGORIES (Tier 1)
// ============================================================================

export function getCategories(): CategoryConfig[] {
	return config.categories.sort((a, b) => a.order - b.order);
}

export function getCategory(categoryId: CategoryId): CategoryConfig | undefined {
	return config.categories.find((c) => c.id === categoryId);
}

export function getDefaultCategory(): CategoryConfig {
	const defaultPath = config.app.defaultPath || '/general/public-lobby';
	const categoryId = defaultPath.split('/')[1];
	return getCategory(categoryId) || config.categories[0];
}

// ============================================================================
// SECTIONS (Tier 2)
// ============================================================================

export function getSections(): SectionConfig[] {
	// Flatten all sections from all categories
	return config.categories
		.flatMap((cat) => cat.sections.map((sec) => ({ ...sec, _categoryId: cat.id })))
		.sort((a, b) => a.order - b.order);
}

export function getSectionsByCategory(categoryId: CategoryId): SectionConfig[] {
	const category = getCategory(categoryId);
	if (!category) return [];
	return category.sections.sort((a, b) => a.order - b.order);
}

export function getSection(sectionId: SectionId): SectionConfig | undefined {
	for (const category of config.categories) {
		const section = category.sections.find((s) => s.id === sectionId);
		if (section) return section;
	}
	return undefined;
}

export function getSectionWithCategory(sectionId: SectionId): { section: SectionConfig; category: CategoryConfig } | undefined {
	for (const category of config.categories) {
		const section = category.sections.find((s) => s.id === sectionId);
		if (section) return { section, category };
	}
	return undefined;
}

export function getDefaultSection(): SectionConfig {
	const defaultPath = config.app.defaultPath || '/general/public-lobby';
	const parts = defaultPath.split('/').filter(Boolean);
	if (parts.length >= 2) {
		const section = getSection(parts[1]);
		if (section) return section;
	}
	return config.categories[0]?.sections[0];
}

export function getSectionsByAccess(requiresApproval: boolean): SectionConfig[] {
	return getSections().filter((s) => s.access.requiresApproval === requiresApproval);
}

// ============================================================================
// ROLES
// ============================================================================

export function getRoles(): RoleConfig[] {
	return config.roles;
}

export function getRole(roleId: RoleId): RoleConfig | undefined {
	return config.roles.find((r) => r.id === roleId);
}

export function roleHasCapability(roleId: RoleId, capability: string): boolean {
	const role = getRole(roleId);
	if (!role) return false;
	if (role.id === 'admin') return true;
	return role.capabilities?.includes(capability) ?? false;
}

export function roleIsHigherThan(roleA: RoleId, roleB: RoleId): boolean {
	const a = getRole(roleA);
	const b = getRole(roleB);
	if (!a || !b) return false;
	return a.level > b.level;
}

export function getHighestRole(roles: RoleId[]): RoleId {
	if (roles.length === 0) return 'guest';
	return roles.reduce((highest, current) => {
		return roleIsHigherThan(current, highest) ? current : highest;
	}, roles[0]);
}

// ============================================================================
// COHORTS
// ============================================================================

export function getCohorts(): CohortConfig[] {
	return config.cohorts;
}

export function getCohort(cohortId: CohortId): CohortConfig | undefined {
	return config.cohorts.find((c) => c.id === cohortId);
}

// ============================================================================
// CALENDAR
// ============================================================================

export function getCalendarAccessLevel(level: CalendarAccessLevel) {
	return config.calendarAccessLevels.find((l) => l.id === level);
}

// ============================================================================
// SUPERUSER
// ============================================================================

export function getSuperuser(): SuperuserConfig | undefined {
	return config.superuser;
}

export function isSuperuser(pubkey: string): boolean {
	return config.superuser?.pubkey === pubkey;
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

import type { BreadcrumbItem } from './types';

export function getBreadcrumbs(categoryId?: CategoryId, sectionId?: SectionId, forumName?: string): BreadcrumbItem[] {
	const crumbs: BreadcrumbItem[] = [
		{ label: 'Home', path: '/', icon: '🏠' }
	];

	if (categoryId) {
		const category = getCategory(categoryId);
		if (category) {
			crumbs.push({
				label: category.name,
				path: `/${categoryId}`,
				icon: category.icon
			});
		}
	}

	if (sectionId) {
		const section = getSection(sectionId);
		if (section) {
			crumbs.push({
				label: section.name,
				path: `/${categoryId}/${sectionId}`,
				icon: section.icon
			});
		}
	}

	if (forumName) {
		crumbs.push({
			label: forumName,
			path: '#',
			icon: '💬'
		});
	}

	return crumbs;
}

export function getCategoryPath(categoryId: CategoryId): string {
	return `/${categoryId}`;
}

export function getSectionPath(categoryId: CategoryId, sectionId: SectionId): string {
	return `/${categoryId}/${sectionId}`;
}

export function getForumPath(categoryId: CategoryId, sectionId: SectionId, forumId: string): string {
	return `/${categoryId}/${sectionId}/${forumId}`;
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

// For code that still uses SECTION_CONFIG map
export function getSectionConfigMap(): Record<string, SectionConfig> {
	const map: Record<string, SectionConfig> = {};
	for (const section of getSections()) {
		map[section.id] = section;
	}
	return map;
}

export const SECTION_CONFIG = getSectionConfigMap();

// Export type aliases
export type { SectionId as ChannelSection } from './types';
