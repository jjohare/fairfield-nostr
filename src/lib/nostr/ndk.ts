import NDK from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { browser } from '$app/environment';

const relayUrls = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

let ndkInstance: NDK | null = null;

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

export async function connectNDK(): Promise<void> {
	if (browser && ndk) {
		await ndk.connect();
	}
}
