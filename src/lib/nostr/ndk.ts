import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { settingsStore, getActiveRelays } from '$lib/stores/settings';

let ndkInstance: NDK | null = null;
let isConnected = false;
let currentRelayUrls: string[] = [];

/**
 * Get or create NDK instance with current relay configuration
 */
export function getNDK(): NDK {
	const relayUrls = getActiveRelays();

	if (!browser) {
		return new NDK({
			explicitRelayUrls: relayUrls
		});
	}

	// If relay configuration changed, recreate instance
	const relaysChanged = JSON.stringify(relayUrls) !== JSON.stringify(currentRelayUrls);

	if (!ndkInstance || relaysChanged) {
		// Disconnect old instance if exists
		if (ndkInstance && isConnected) {
			try {
				// NDK doesn't have a disconnect method, but we can clear pools
				ndkInstance.pool.relays.forEach(relay => relay.disconnect());
			} catch (e) {
				console.warn('Error disconnecting old NDK instance:', e);
			}
			isConnected = false;
		}

		const dexieAdapter = new NDKCacheAdapterDexie({ dbName: 'minimoonoir-cache' });

		ndkInstance = new NDK({
			explicitRelayUrls: relayUrls,
			cacheAdapter: dexieAdapter
		});

		currentRelayUrls = [...relayUrls];
		if (import.meta.env.DEV) {
			console.log('NDK configured with relays:', relayUrls);
		}
	}

	return ndkInstance;
}

export const ndk = browser ? getNDK() : new NDK({ explicitRelayUrls: getActiveRelays() });

/**
 * Connect NDK to relays
 */
export async function connectNDK(): Promise<void> {
	if (!browser) return;

	const instance = getNDK();

	if (!isConnected) {
		await instance.connect();
		isConnected = true;
		if (import.meta.env.DEV) {
			console.log('NDK connected to relays:', currentRelayUrls);
		}
	}
}

/**
 * Reconnect NDK with updated relay configuration
 */
export async function reconnectNDK(): Promise<void> {
	if (!browser) return;

	isConnected = false;
	ndkInstance = null;

	await connectNDK();
}

/**
 * Set a signer for authenticated operations
 */
export function setSigner(privateKey: string): void {
	if (!browser) return;

	const instance = getNDK();
	const signer = new NDKPrivateKeySigner(privateKey);
	instance.signer = signer;
}

/**
 * Clear the current signer (logout)
 */
export function clearSigner(): void {
	if (!browser || !ndkInstance) return;
	ndkInstance.signer = undefined;
}

/**
 * Check if NDK has a signer configured
 */
export function hasSigner(): boolean {
	return browser && ndkInstance?.signer !== undefined;
}

/**
 * Get connection status
 */
export function isNDKConnected(): boolean {
	return isConnected;
}

/**
 * Get configured relay URLs
 */
export function getRelayUrls(): string[] {
	return currentRelayUrls;
}

// Subscribe to settings changes to auto-reconnect
if (browser) {
	settingsStore.subscribe(() => {
		// Settings changed - will reconnect on next getNDK() call
		const newRelays = getActiveRelays();
		if (JSON.stringify(newRelays) !== JSON.stringify(currentRelayUrls)) {
			console.log('Relay configuration changed, will reconnect on next operation');
		}
	});
}
