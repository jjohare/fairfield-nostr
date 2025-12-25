/**
 * Permission Checker
 * Centralized permission checking using config-driven roles and sections
 */

import type { RoleId, SectionId, CohortId, UserPermissions, UserSectionRole } from './types';
import { getRole, getSection, roleHasCapability, roleIsHigherThan, getHighestRole } from './loader';

/**
 * Check if user has a specific capability
 */
export function hasCapability(
	permissions: UserPermissions,
	capability: string,
	sectionId?: SectionId
): boolean {
	// Global admin has all capabilities
	if (permissions.globalRole === 'admin') {
		return true;
	}

	// Check global role capabilities
	if (roleHasCapability(permissions.globalRole, capability)) {
		return true;
	}

	// Check section-specific role if sectionId provided
	if (sectionId) {
		const sectionRole = permissions.sectionRoles.find((sr) => sr.sectionId === sectionId);
		if (sectionRole && roleHasCapability(sectionRole.role, capability)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if user can access a section
 */
export function canAccessSection(permissions: UserPermissions, sectionId: SectionId): boolean {
	const section = getSection(sectionId);
	if (!section) return false;

	// Auto-approve sections are always accessible
	if (section.access.autoApprove) {
		return true;
	}

	// Global admin can access everything
	if (permissions.globalRole === 'admin') {
		return true;
	}

	// Check for section-specific role
	const sectionRole = permissions.sectionRoles.find((sr) => sr.sectionId === sectionId);
	if (sectionRole) {
		return true;
	}

	// Check required cohorts
	if (section.access.requiredCohorts?.length) {
		return section.access.requiredCohorts.some((cohort) => permissions.cohorts.includes(cohort));
	}

	return false;
}

/**
 * Get user's effective role for a section
 */
export function getEffectiveRole(permissions: UserPermissions, sectionId: SectionId): RoleId {
	// Global admin is always admin everywhere
	if (permissions.globalRole === 'admin') {
		return 'admin';
	}

	// Check section-specific role
	const sectionRole = permissions.sectionRoles.find((sr) => sr.sectionId === sectionId);
	if (sectionRole) {
		// Return higher of global or section role
		return roleIsHigherThan(permissions.globalRole, sectionRole.role)
			? permissions.globalRole
			: sectionRole.role;
	}

	// Fall back to global role or guest
	const section = getSection(sectionId);
	if (section?.access.autoApprove) {
		return permissions.globalRole || 'guest';
	}

	return 'guest';
}

/**
 * Check if user can manage a section (section-admin or higher)
 */
export function canManageSection(permissions: UserPermissions, sectionId: SectionId): boolean {
	const effectiveRole = getEffectiveRole(permissions, sectionId);
	const role = getRole(effectiveRole);
	return role ? role.level >= 3 : false; // section-admin level
}

/**
 * Check if user can moderate in a section (moderator or higher)
 */
export function canModerateSection(permissions: UserPermissions, sectionId: SectionId): boolean {
	const effectiveRole = getEffectiveRole(permissions, sectionId);
	const role = getRole(effectiveRole);
	return role ? role.level >= 2 : false; // moderator level
}

/**
 * Check if user can create forums/channels in a section
 */
export function canCreateChannel(permissions: UserPermissions, sectionId: SectionId): boolean {
	const section = getSection(sectionId);
	if (!section?.allowForumCreation) {
		return false;
	}

	// Need at least moderator role or forum.create capability
	return hasCapability(permissions, 'forum.create', sectionId);
}

/**
 * Check if user can view calendar events in a section
 */
export function canViewCalendar(permissions: UserPermissions, sectionId: SectionId): boolean {
	const section = getSection(sectionId);
	if (!section) return false;

	const calendarAccess = section.calendar.access;
	if (calendarAccess === 'none') return false;

	return canAccessSection(permissions, sectionId);
}

/**
 * Check if user can view full calendar event details
 */
export function canViewCalendarDetails(
	permissions: UserPermissions,
	sectionId: SectionId,
	eventCohorts?: CohortId[]
): boolean {
	const section = getSection(sectionId);
	if (!section) return false;

	const calendarAccess = section.calendar.access;

	// Full access level
	if (calendarAccess === 'full') {
		return canAccessSection(permissions, sectionId);
	}

	// Availability only - no details
	if (calendarAccess === 'availability') {
		return false;
	}

	// Cohort restricted - check cohort match
	if (calendarAccess === 'cohort' && section.calendar.cohortRestricted) {
		if (!eventCohorts?.length) return false;
		return eventCohorts.some((cohort) => permissions.cohorts.includes(cohort));
	}

	return false;
}

/**
 * Check if user can create calendar events in a section
 */
export function canCreateCalendarEvent(
	permissions: UserPermissions,
	sectionId: SectionId
): boolean {
	const section = getSection(sectionId);
	if (!section?.calendar.canCreate) {
		return false;
	}

	// Need section access and at least member role
	return (
		canAccessSection(permissions, sectionId) && getEffectiveRole(permissions, sectionId) !== 'guest'
	);
}

/**
 * Check if user is a global admin
 */
export function isGlobalAdmin(permissions: UserPermissions): boolean {
	return permissions.globalRole === 'admin' || permissions.cohorts.includes('admin');
}

/**
 * Check if user is section admin for a specific section
 */
export function isSectionAdmin(permissions: UserPermissions, sectionId: SectionId): boolean {
	if (isGlobalAdmin(permissions)) return true;

	const sectionRole = permissions.sectionRoles.find((sr) => sr.sectionId === sectionId);
	return sectionRole?.role === 'section-admin' || sectionRole?.role === 'admin';
}

/**
 * Get all sections user can access
 */
export function getAccessibleSections(
	permissions: UserPermissions,
	allSectionIds: SectionId[]
): SectionId[] {
	return allSectionIds.filter((id) => canAccessSection(permissions, id));
}

/**
 * Get all sections user can manage
 */
export function getManageableSections(
	permissions: UserPermissions,
	allSectionIds: SectionId[]
): SectionId[] {
	return allSectionIds.filter((id) => canManageSection(permissions, id));
}

/**
 * Create default permissions for a new user
 */
export function createDefaultPermissions(pubkey: string): UserPermissions {
	return {
		pubkey,
		cohorts: [],
		globalRole: 'guest',
		sectionRoles: []
	};
}

/**
 * Create admin permissions
 */
export function createAdminPermissions(pubkey: string): UserPermissions {
	return {
		pubkey,
		cohorts: ['admin'],
		globalRole: 'admin',
		sectionRoles: []
	};
}

/**
 * Add section role to permissions
 */
export function addSectionRole(
	permissions: UserPermissions,
	sectionId: SectionId,
	role: RoleId,
	assignedBy?: string
): UserPermissions {
	const existingRoles = permissions.sectionRoles.filter((sr) => sr.sectionId !== sectionId);

	return {
		...permissions,
		sectionRoles: [
			...existingRoles,
			{
				sectionId,
				role,
				assignedAt: Date.now(),
				assignedBy
			}
		]
	};
}

/**
 * Remove section role from permissions
 */
export function removeSectionRole(
	permissions: UserPermissions,
	sectionId: SectionId
): UserPermissions {
	return {
		...permissions,
		sectionRoles: permissions.sectionRoles.filter((sr) => sr.sectionId !== sectionId)
	};
}

/**
 * Add cohort to user permissions
 */
export function addCohort(permissions: UserPermissions, cohortId: CohortId): UserPermissions {
	if (permissions.cohorts.includes(cohortId)) {
		return permissions;
	}

	return {
		...permissions,
		cohorts: [...permissions.cohorts, cohortId]
	};
}

/**
 * Remove cohort from user permissions
 */
export function removeCohort(permissions: UserPermissions, cohortId: CohortId): UserPermissions {
	return {
		...permissions,
		cohorts: permissions.cohorts.filter((c) => c !== cohortId)
	};
}
