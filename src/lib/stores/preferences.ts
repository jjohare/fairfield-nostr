/**
 * User preferences store
 * Manages application-wide user preferences
 */

import { writable } from 'svelte/store';

export interface UserPreferences {
	linkPreviewsEnabled: boolean;
	mediaAutoPlay: boolean;
	theme: 'light' | 'dark' | 'auto';
	notificationsEnabled: boolean;
	soundEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
	linkPreviewsEnabled: true,
	mediaAutoPlay: false,
	theme: 'auto',
	notificationsEnabled: true,
	soundEnabled: true,
};

const STORAGE_KEY = 'fairfield-user-preferences';

/**
 * Load preferences from localStorage
 */
function loadPreferences(): UserPreferences {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return DEFAULT_PREFERENCES;

		const parsed = JSON.parse(stored);
		return { ...DEFAULT_PREFERENCES, ...parsed };
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

/**
 * Save preferences to localStorage
 */
function savePreferences(preferences: UserPreferences): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
	} catch (error) {
		console.warn('Failed to save preferences:', error);
	}
}

/**
 * User preferences store
 */
function createPreferencesStore() {
	const { subscribe, set, update } = writable<UserPreferences>(DEFAULT_PREFERENCES);

	// Load preferences on initialization
	if (typeof window !== 'undefined') {
		set(loadPreferences());
	}

	return {
		subscribe,
		/**
		 * Update preferences
		 */
		update: (updater: (preferences: UserPreferences) => UserPreferences) => {
			update((current) => {
				const updated = updater(current);
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Set entire preferences object
		 */
		set: (preferences: UserPreferences) => {
			savePreferences(preferences);
			set(preferences);
		},
		/**
		 * Toggle link previews
		 */
		toggleLinkPreviews: () => {
			update((current) => {
				const updated = { ...current, linkPreviewsEnabled: !current.linkPreviewsEnabled };
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Toggle media auto-play
		 */
		toggleMediaAutoPlay: () => {
			update((current) => {
				const updated = { ...current, mediaAutoPlay: !current.mediaAutoPlay };
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Set theme
		 */
		setTheme: (theme: 'light' | 'dark' | 'auto') => {
			update((current) => {
				const updated = { ...current, theme };
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Toggle notifications
		 */
		toggleNotifications: () => {
			update((current) => {
				const updated = { ...current, notificationsEnabled: !current.notificationsEnabled };
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Toggle sound
		 */
		toggleSound: () => {
			update((current) => {
				const updated = { ...current, soundEnabled: !current.soundEnabled };
				savePreferences(updated);
				return updated;
			});
		},
		/**
		 * Reset to defaults
		 */
		reset: () => {
			savePreferences(DEFAULT_PREFERENCES);
			set(DEFAULT_PREFERENCES);
		},
	};
}

export const preferencesStore = createPreferencesStore();
