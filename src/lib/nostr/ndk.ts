import NDK, { NDKPrivateKeySigner, type NDKSigner } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { browser } from '$app/environment';

// Get relay URLs from environment or use defaults
const envRelays = import.meta.env.VITE_RELAY_URLS;
const relayUrls = envRelays
	? envRelays.split(',').map((r: string) => r.trim())
	: ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

let ndkInstance: NDK | null = null;
let isConnected = false;

export function getNDK(): NDK {
	if (!browser) {
		return new NDK({
			explicitRelayUrls: relayUrls
		});
	}

	if (!ndkInstance) {
		const dexieAdapter = new NDKCacheAdapterDexie({ dbName: 'fairfield-nostr-cache' });

		ndkInstance = new NDK({
			explicitRelayUrls: relayUrls,
			cacheAdapter: dexieAdapter
		});
	}

	return ndkInstance;
}

export const ndk = browser ? getNDK() : new NDK({ explicitRelayUrls: relayUrls });

/**
 * Connect NDK to relays
 */
export async function connectNDK(): Promise<void> {
	if (browser && ndk && !isConnected) {
		await ndk.connect();
		isConnected = true;
		console.log('NDK connected to relays:', relayUrls);
	}
}

/**
 * Set a signer for authenticated operations
 * @param privateKey - Hex-encoded private key
 */
export function setSigner(privateKey: string): void {
	if (!browser || !ndk) return;

	const signer = new NDKPrivateKeySigner(privateKey);
	ndk.signer = signer;
	console.log('NDK signer configured');
}

/**
 * Clear the current signer (logout)
 */
export function clearSigner(): void {
	if (!browser || !ndk) return;
	ndk.signer = undefined;
}

/**
 * Check if NDK has a signer configured
 */
export function hasSigner(): boolean {
	return browser && ndk?.signer !== undefined;
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
	return relayUrls;
}
