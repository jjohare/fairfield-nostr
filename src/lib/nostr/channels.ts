/**
 * Channel Service - Nostr channel operations using NDK
 * Implements NIP-28 (Public Chat) event kinds
 */
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import { ndk, connectNDK, hasSigner } from './ndk';
import { browser } from '$app/environment';

// NIP-28 Event Kinds for Public Chat
export const CHANNEL_KINDS = {
	CREATE: 40,      // Channel creation
	METADATA: 41,    // Channel metadata
	MESSAGE: 42,     // Channel message
	HIDE_MESSAGE: 43, // Hide message
	MUTE_USER: 44,   // Mute user in channel
} as const;

export interface ChannelMetadata {
	name: string;
	about?: string;
	picture?: string;
	relays?: string[];
}

export interface ChannelCreateOptions {
	name: string;
	description?: string;
	visibility?: 'public' | 'cohort' | 'private';
	cohorts?: string[];
	encrypted?: boolean;
}

export interface CreatedChannel {
	id: string;
	name: string;
	description?: string;
	visibility: 'public' | 'cohort' | 'private';
	cohorts: string[];
	encrypted: boolean;
	createdAt: number;
	creatorPubkey: string;
}

/**
 * Create a new channel (NIP-28 kind 40)
 */
export async function createChannel(options: ChannelCreateOptions): Promise<CreatedChannel> {
	if (!browser) {
		throw new Error('Channel creation requires browser environment');
	}

	if (!hasSigner()) {
		throw new Error('No signer configured. Please login first.');
	}

	// Ensure connected
	await connectNDK();

	// Build channel metadata
	const metadata: ChannelMetadata = {
		name: options.name,
		about: options.description,
	};

	// Create the event
	const event = new NDKEvent(ndk);
	event.kind = CHANNEL_KINDS.CREATE;
	event.content = JSON.stringify(metadata);

	// Add custom tags for visibility/cohorts
	if (options.visibility && options.visibility !== 'public') {
		event.tags.push(['visibility', options.visibility]);
	}

	if (options.cohorts && options.cohorts.length > 0) {
		event.tags.push(['cohort', options.cohorts.join(',')]);
	}

	if (options.encrypted) {
		event.tags.push(['encrypted', 'true']);
	}

	// Sign and publish
	await event.sign();
	await event.publish();

	return {
		id: event.id,
		name: options.name,
		description: options.description,
		visibility: options.visibility || 'public',
		cohorts: options.cohorts || [],
		encrypted: options.encrypted || false,
		createdAt: event.created_at || Math.floor(Date.now() / 1000),
		creatorPubkey: event.pubkey,
	};
}

/**
 * Update channel metadata (NIP-28 kind 41)
 */
export async function updateChannelMetadata(
	channelId: string,
	metadata: Partial<ChannelMetadata>
): Promise<void> {
	if (!browser) {
		throw new Error('Channel operations require browser environment');
	}

	if (!hasSigner()) {
		throw new Error('No signer configured. Please login first.');
	}

	await connectNDK();

	const event = new NDKEvent(ndk);
	event.kind = CHANNEL_KINDS.METADATA;
	event.content = JSON.stringify(metadata);
	event.tags.push(['e', channelId, '', 'root']);

	await event.sign();
	await event.publish();
}

/**
 * Send a message to a channel (NIP-28 kind 42)
 */
export async function sendChannelMessage(
	channelId: string,
	content: string,
	replyTo?: string
): Promise<string> {
	if (!browser) {
		throw new Error('Channel operations require browser environment');
	}

	if (!hasSigner()) {
		throw new Error('No signer configured. Please login first.');
	}

	await connectNDK();

	const event = new NDKEvent(ndk);
	event.kind = CHANNEL_KINDS.MESSAGE;
	event.content = content;
	event.tags.push(['e', channelId, '', 'root']);

	if (replyTo) {
		event.tags.push(['e', replyTo, '', 'reply']);
	}

	await event.sign();
	await event.publish();

	return event.id;
}

/**
 * Fetch channels from relays
 */
export async function fetchChannels(limit = 100): Promise<CreatedChannel[]> {
	if (!browser) {
		return [];
	}

	await connectNDK();

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.CREATE],
		limit,
	};

	const events = await ndk.fetchEvents(filter);
	const channels: CreatedChannel[] = [];

	for (const event of events) {
		try {
			const metadata = JSON.parse(event.content) as ChannelMetadata;
			const visibilityTag = event.tags.find(t => t[0] === 'visibility');
			const cohortTag = event.tags.find(t => t[0] === 'cohort');
			const encryptedTag = event.tags.find(t => t[0] === 'encrypted');

			channels.push({
				id: event.id,
				name: metadata.name || 'Unnamed Channel',
				description: metadata.about,
				visibility: (visibilityTag?.[1] as any) || 'public',
				cohorts: cohortTag?.[1]?.split(',').filter(Boolean) || [],
				encrypted: encryptedTag?.[1] === 'true',
				createdAt: event.created_at || 0,
				creatorPubkey: event.pubkey,
			});
		} catch (e) {
			console.error('Failed to parse channel event:', e);
		}
	}

	// Sort by creation time (newest first)
	channels.sort((a, b) => b.createdAt - a.createdAt);

	return channels;
}

/**
 * Fetch messages for a channel
 */
export async function fetchChannelMessages(
	channelId: string,
	limit = 50
): Promise<Array<{
	id: string;
	content: string;
	pubkey: string;
	createdAt: number;
	replyTo?: string;
}>> {
	if (!browser) {
		return [];
	}

	await connectNDK();

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.MESSAGE],
		'#e': [channelId],
		limit,
	};

	const events = await ndk.fetchEvents(filter);
	const messages: Array<{
		id: string;
		content: string;
		pubkey: string;
		createdAt: number;
		replyTo?: string;
	}> = [];

	for (const event of events) {
		const replyTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply');

		messages.push({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			createdAt: event.created_at || 0,
			replyTo: replyTag?.[1],
		});
	}

	// Sort by creation time (oldest first for messages)
	messages.sort((a, b) => a.createdAt - b.createdAt);

	return messages;
}

/**
 * Subscribe to channel messages in real-time
 */
export function subscribeToChannel(
	channelId: string,
	onMessage: (message: {
		id: string;
		content: string;
		pubkey: string;
		createdAt: number;
		replyTo?: string;
	}) => void
): { unsubscribe: () => void } {
	if (!browser) {
		return { unsubscribe: () => {} };
	}

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.MESSAGE],
		'#e': [channelId],
		since: Math.floor(Date.now() / 1000),
	};

	const sub = ndk.subscribe(filter, { closeOnEose: false });

	sub.on('event', (event: NDKEvent) => {
		const replyTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply');

		onMessage({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			createdAt: event.created_at || 0,
			replyTo: replyTag?.[1],
		});
	});

	return {
		unsubscribe: () => {
			sub.stop();
		},
	};
}
