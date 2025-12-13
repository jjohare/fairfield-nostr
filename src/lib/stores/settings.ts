import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface AppSettings {
  relayMode: 'private' | 'federated';
  privateRelayUrl: string;
  federatedRelays: string[];
}

const STORAGE_KEY = 'minimoonoir-settings';

/**
 * Get the private relay URL based on current browser location
 */
function getPrivateRelayUrl(): string {
  if (!browser) return 'ws://localhost:3000/relay';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/relay`;
}

function getDefaultSettings(): AppSettings {
  return {
    relayMode: 'private', // Default to private (local relay only)
    privateRelayUrl: getPrivateRelayUrl(),
    federatedRelays: [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.primal.net'
    ]
  };
}

function loadSettings(): AppSettings {
  if (!browser) return getDefaultSettings();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Always update privateRelayUrl to current host
      return {
        ...getDefaultSettings(),
        ...parsed,
        privateRelayUrl: getPrivateRelayUrl()
      };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }

  return getDefaultSettings();
}

function saveSettings(settings: AppSettings): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>(getDefaultSettings());

  // Initialize with loaded settings when in browser
  if (browser) {
    set(loadSettings());
  }

  return {
    subscribe,

    setRelayMode: (mode: 'private' | 'federated') => {
      update(s => {
        const newSettings = { ...s, relayMode: mode };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setPrivateRelayUrl: (url: string) => {
      update(s => {
        const newSettings = { ...s, privateRelayUrl: url };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setFederatedRelays: (relays: string[]) => {
      update(s => {
        const newSettings = { ...s, federatedRelays: relays };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    reset: () => {
      const defaults = getDefaultSettings();
      set(defaults);
      saveSettings(defaults);
    }
  };
}

export const settingsStore = createSettingsStore();

/**
 * Get the active relay URLs based on current mode
 */
export function getActiveRelays(): string[] {
  if (!browser) {
    return [getPrivateRelayUrl()];
  }

  const settings = get(settingsStore);

  if (settings.relayMode === 'private') {
    // Always use current host for private relay
    return [getPrivateRelayUrl()];
  }

  return settings.federatedRelays;
}

/**
 * Check if running in private mode
 */
export function isPrivateMode(): boolean {
  if (!browser) return true;
  return get(settingsStore).relayMode === 'private';
}
