import { WebSocket } from 'ws';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// Event kinds
const KIND_ADD_USER = 9000;
const KIND_REMOVE_USER = 9001;

interface Whitelist {
  admins: { pubkey: string; name?: string; roles?: string[] }[];
  users: { pubkey: string; status: 'approved' | 'pending' | 'banned'; added?: string }[];
  banned: { pubkey: string; reason?: string }[];
}

interface NostrEvent {
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  created_at: number;
}

export class WhitelistSync {
  private ws: WebSocket | null = null;
  private relayUrl: string;
  private whitelistPath: string;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor(relayUrl: string, whitelistPath: string) {
    this.relayUrl = relayUrl;
    this.whitelistPath = whitelistPath;
  }

  start() {
    this.connect();
  }

  private connect() {
    console.log(`[WhitelistSync] Connecting to ${this.relayUrl}`);
    this.ws = new WebSocket(this.relayUrl);

    this.ws.on('open', () => {
      console.log('[WhitelistSync] Connected');
      this.subscribe();
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (Array.isArray(msg) && msg[0] === 'EVENT') {
          await this.handleEvent(msg[2]);
        }
      } catch (err) {
        console.error('[WhitelistSync] Error parsing message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[WhitelistSync] Disconnected, reconnecting in 5s...');
      this.reconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[WhitelistSync] WebSocket error:', err);
      this.ws?.close();
    });
  }

  private reconnect() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = null;
      this.connect();
    }, 5000);
  }

  private subscribe() {
    // Subscribe to NIP-29 Add/Remove user events
    const filter = {
      kinds: [KIND_ADD_USER, KIND_REMOVE_USER],
      // We could add 'since' here to only get new events, 
      // but for simplicity we'll just process everything for now
      // Ideally we should sync state periodically or use a more robust sync mechanism
    };
    this.ws?.send(JSON.stringify(['REQ', 'whitelist-sync', filter]));
  }

  private async handleEvent(event: NostrEvent) {
    try {
      const whitelist = await this.readWhitelist();
      let modified = false;

      // Extract target user pubkey from tags
      const pTag = event.tags.find(t => t[0] === 'p');
      if (!pTag) return;
      const targetPubkey = pTag[1];

      if (event.kind === KIND_ADD_USER) {
        // Add user to approved list
        if (!whitelist.users.some(u => u.pubkey === targetPubkey)) {
          whitelist.users.push({
            pubkey: targetPubkey,
            status: 'approved',
            added: new Date(event.created_at * 1000).toISOString()
          });
          // Remove from banned/pending if present
          whitelist.banned = whitelist.banned.filter(u => u.pubkey !== targetPubkey);
          modified = true;
          console.log(`[WhitelistSync] Approved user ${targetPubkey}`);
        }
      } else if (event.kind === KIND_REMOVE_USER) {
        // Remove user (ban/kick)
        const userIndex = whitelist.users.findIndex(u => u.pubkey === targetPubkey);
        if (userIndex !== -1) {
          whitelist.users.splice(userIndex, 1);
          whitelist.banned.push({
            pubkey: targetPubkey,
            reason: event.content || 'Removed by admin'
          });
          modified = true;
          console.log(`[WhitelistSync] Removed/Banned user ${targetPubkey}`);
        }
      }

      if (modified) {
        await this.writeWhitelist(whitelist);
      }
    } catch (err) {
      console.error('[WhitelistSync] Error handling event:', err);
    }
  }

  private async readWhitelist(): Promise<Whitelist> {
    try {
      const data = await readFile(this.whitelistPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      // Return default structure if file doesn't exist
      return { admins: [], users: [], banned: [] };
    }
  }

  private async writeWhitelist(whitelist: Whitelist): Promise<void> {
    await writeFile(this.whitelistPath, JSON.stringify(whitelist, null, 2));
  }
}