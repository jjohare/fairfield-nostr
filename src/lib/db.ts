import Dexie, { type Table } from 'dexie';

/**
 * Message interface for Dexie database
 */
export interface DBMessage {
  id: string;
  channelId: string;
  pubkey: string;
  content: string;
  created_at: number;
  encrypted: boolean;
  deleted: boolean;
  authorName?: string;
  authorAvatar?: string;
  kind: number;
  tags: string[][];
  sig: string;
}

/**
 * Channel interface for Dexie database
 */
export interface DBChannel {
  id: string;
  name: string;
  about: string | null;
  picture: string | null;
  creatorPubkey: string;
  created_at: number;
  isPrivate: boolean;
  isEncrypted: boolean;
  memberPubkeys: string[];
  adminPubkeys: string[];
  kind: number;
  tags: string[][];
}

/**
 * User profile cache for Dexie database
 */
export interface DBUser {
  pubkey: string;
  name: string | null;
  displayName: string | null;
  avatar: string | null;
  about: string | null;
  nip05: string | null;
  lud16: string | null;
  website: string | null;
  banner: string | null;
  created_at: number | null;
  updated_at: number | null;
  cached_at: number;
}

/**
 * Deletion event tracking
 */
export interface DBDeletion {
  id: string;
  deletedEventId: string;
  channelId: string;
  deleterPubkey: string;
  created_at: number;
  kind: number; // 5 for NIP-09, 9005 for NIP-29
}

/**
 * Relay connection state
 */
export interface DBRelay {
  url: string;
  connected: boolean;
  lastConnected: number | null;
  lastError: string | null;
  subscriptions: string[];
}

/**
 * Minimoomaa Noir Database
 */
class MinimoomaNoirDB extends Dexie {
  messages!: Table<DBMessage, string>;
  channels!: Table<DBChannel, string>;
  users!: Table<DBUser, string>;
  deletions!: Table<DBDeletion, string>;
  relays!: Table<DBRelay, string>;

  constructor() {
    super('MinimoomaNoirDB');

    this.version(1).stores({
      messages: 'id, channelId, pubkey, created_at, deleted, [channelId+created_at]',
      channels: 'id, creatorPubkey, created_at, isPrivate, isEncrypted',
      users: 'pubkey, cached_at',
      deletions: 'id, deletedEventId, channelId, deleterPubkey, created_at',
      relays: 'url, connected, lastConnected'
    });
  }

  /**
   * Clear all data from the database
   */
  async clearAll(): Promise<void> {
    await this.messages.clear();
    await this.channels.clear();
    await this.users.clear();
    await this.deletions.clear();
    await this.relays.clear();
  }

  /**
   * Delete old cached data (older than 7 days)
   */
  async pruneOldCache(): Promise<void> {
    const sevenDaysAgo = Date.now() / 1000 - (7 * 24 * 60 * 60);

    // Prune old user cache
    await this.users
      .where('cached_at')
      .below(sevenDaysAgo)
      .delete();

    // Prune old deleted messages
    await this.deletions
      .where('created_at')
      .below(sevenDaysAgo)
      .delete();
  }

  /**
   * Get messages for a channel with author info
   */
  async getChannelMessagesWithAuthors(channelId: string): Promise<(DBMessage & { author: DBUser | null })[]> {
    const messages = await this.messages
      .where('channelId')
      .equals(channelId)
      .and(msg => !msg.deleted)
      .sortBy('created_at');

    const messagesWithAuthors = await Promise.all(
      messages.map(async (msg) => {
        const author = await this.users.get(msg.pubkey);
        return { ...msg, author: author || null };
      })
    );

    return messagesWithAuthors;
  }

  /**
   * Mark message as deleted
   */
  async markMessageDeleted(messageId: string): Promise<void> {
    await this.messages.update(messageId, { deleted: true });
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId: string): Promise<DBChannel | undefined> {
    return await this.channels.get(channelId);
  }

  /**
   * Get user by pubkey
   */
  async getUser(pubkey: string): Promise<DBUser | undefined> {
    return await this.users.get(pubkey);
  }

  /**
   * Cache user profile
   */
  async cacheUser(user: Omit<DBUser, 'cached_at'>): Promise<void> {
    await this.users.put({
      ...user,
      cached_at: Date.now() / 1000
    });
  }

  /**
   * Check if message is deleted
   */
  async isMessageDeleted(messageId: string): Promise<boolean> {
    const deletion = await this.deletions.get(messageId);
    return deletion !== undefined;
  }

  /**
   * Add deletion event
   */
  async addDeletion(deletion: DBDeletion): Promise<void> {
    await this.deletions.put(deletion);
    await this.markMessageDeleted(deletion.deletedEventId);
  }

  /**
   * Update relay connection state
   */
  async updateRelay(url: string, updates: Partial<DBRelay>): Promise<void> {
    const existing = await this.relays.get(url);

    if (existing) {
      await this.relays.update(url, updates);
    } else {
      await this.relays.put({
        url,
        connected: false,
        lastConnected: null,
        lastError: null,
        subscriptions: [],
        ...updates
      });
    }
  }

  /**
   * Get all messages for export
   */
  async exportMessages(channelId?: string): Promise<DBMessage[]> {
    if (channelId) {
      return await this.messages
        .where('channelId')
        .equals(channelId)
        .toArray();
    }
    return await this.messages.toArray();
  }

  /**
   * Import messages from backup
   */
  async importMessages(messages: DBMessage[]): Promise<void> {
    await this.messages.bulkPut(messages);
  }
}

/**
 * Singleton database instance
 */
export const db = new MinimoomaNoirDB();

/**
 * Initialize database and run maintenance
 */
export async function initDB(): Promise<void> {
  try {
    await db.open();
    await db.pruneOldCache();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDB(): Promise<void> {
  await db.close();
}
