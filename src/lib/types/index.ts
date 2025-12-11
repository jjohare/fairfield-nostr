export interface NostrProfile {
	pubkey: string;
	name?: string;
	display_name?: string;
	about?: string;
	picture?: string;
	nip05?: string;
	lud16?: string;
	banner?: string;
}

export interface NostrMessage {
	id: string;
	pubkey: string;
	created_at: number;
	content: string;
	tags: string[][];
	sig: string;
	kind: number;
}

export interface ChatRoom {
	id: string;
	name: string;
	members: string[];
	lastMessage?: NostrMessage;
	unreadCount: number;
	created_at: number;
}

export interface AppSettings {
	theme: 'light' | 'dark';
	relays: string[];
	notifications: boolean;
	aiEnabled: boolean;
}

export interface KeyPair {
	privateKey: string;
	publicKey: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
