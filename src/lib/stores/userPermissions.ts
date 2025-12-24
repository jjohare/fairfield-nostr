/**
 * User Permissions Store
 * Derives user permissions from auth state and provides default guest permissions
 */

import { derived } from 'svelte/store';
import { authStore } from './auth';
import type { UserPermissions } from '$lib/config/types';

/**
 * Derived store that provides user permissions based on auth state
 * Returns null if user is not authenticated
 */
export const userPermissionsStore = derived<typeof authStore, UserPermissions | null>(
	authStore,
	($auth) => {
		// Not authenticated - return null
		if (!$auth.isAuthenticated || !$auth.pubkey) {
			return null;
		}

		// Return basic member permissions for authenticated users
		// In a real implementation, this would fetch from the server or derive from profile
		return {
			pubkey: $auth.pubkey,
			cohorts: [], // Would be populated from user profile
			globalRole: 'member' as const,
			sectionRoles: [] // Would be populated from user profile
		};
	}
);

/**
 * Check if user has admin permissions
 */
export const isAdmin = derived(userPermissionsStore, ($permissions) => {
	return $permissions?.globalRole === 'admin';
});

/**
 * Get user's public key from permissions
 */
export const userPubkey = derived(userPermissionsStore, ($permissions) => {
	return $permissions?.pubkey ?? null;
});
