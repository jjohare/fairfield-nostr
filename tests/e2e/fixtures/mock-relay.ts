/**
 * Mock Nostr Relay for E2E Testing
 *
 * Provides a WebSocket server that simulates a Nostr relay
 * for testing without requiring a real relay connection.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export interface NostrEvent {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

export interface MockRelayConfig {
  port: number;
  requireAuth?: boolean;
  adminPubkey?: string;
}

export class MockNostrRelay {
  private wss: WebSocketServer | null = null;
  private config: MockRelayConfig;
  private events: Map<string, NostrEvent> = new Map();
  private subscriptions: Map<string, any[]> = new Map();
  private authenticatedClients: Set<WebSocket> = new Set();

  constructor(config: MockRelayConfig) {
    this.config = config;
  }

  /**
   * Start the mock relay server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.port,
          host: 'localhost'
        });

        this.wss.on('listening', () => {
          console.log(`[MockRelay] Listening on ws://localhost:${this.config.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('[MockRelay] Server error:', error);
          reject(error);
        });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the mock relay server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          console.log('[MockRelay] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    console.log('[MockRelay] New connection from', req.socket.remoteAddress);

    // Send AUTH challenge if required
    if (this.config.requireAuth) {
      const challenge = this.generateChallenge();
      this.send(ws, ['AUTH', challenge]);
    }

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('[MockRelay] Failed to parse message:', error);
        this.send(ws, ['NOTICE', 'Invalid message format']);
      }
    });

    ws.on('close', () => {
      this.authenticatedClients.delete(ws);
      console.log('[MockRelay] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[MockRelay] WebSocket error:', error);
    });
  }

  /**
   * Handle incoming Nostr message
   */
  private handleMessage(ws: WebSocket, message: any[]): void {
    if (!Array.isArray(message) || message.length === 0) {
      this.send(ws, ['NOTICE', 'Invalid message format']);
      return;
    }

    const [verb, ...args] = message;

    switch (verb) {
      case 'EVENT':
        this.handleEvent(ws, args[0]);
        break;
      case 'REQ':
        this.handleReq(ws, args[0], ...args.slice(1));
        break;
      case 'CLOSE':
        this.handleClose(ws, args[0]);
        break;
      case 'AUTH':
        this.handleAuth(ws, args[0]);
        break;
      default:
        this.send(ws, ['NOTICE', `Unknown verb: ${verb}`]);
    }
  }

  /**
   * Handle EVENT message
   */
  private handleEvent(ws: WebSocket, event: NostrEvent): void {
    if (!this.isAuthenticated(ws) && this.config.requireAuth) {
      this.send(ws, ['OK', event.id, false, 'auth-required: authentication required']);
      return;
    }

    // Validate event structure
    if (!this.validateEvent(event)) {
      this.send(ws, ['OK', event.id, false, 'invalid: event validation failed']);
      return;
    }

    // Store event
    const eventId = event.id || this.generateEventId(event);
    this.events.set(eventId, { ...event, id: eventId });

    // Send OK response
    this.send(ws, ['OK', eventId, true, '']);

    // Broadcast to subscribers
    this.broadcastEvent(event);
  }

  /**
   * Handle REQ message (subscription)
   */
  private handleReq(ws: WebSocket, subId: string, ...filters: any[]): void {
    if (!this.isAuthenticated(ws) && this.config.requireAuth) {
      this.send(ws, ['CLOSED', subId, 'auth-required: authentication required']);
      return;
    }

    // Store subscription
    this.subscriptions.set(subId, filters);

    // Send matching events
    const matchingEvents = this.findMatchingEvents(filters);
    for (const event of matchingEvents) {
      this.send(ws, ['EVENT', subId, event]);
    }

    // Send EOSE
    this.send(ws, ['EOSE', subId]);
  }

  /**
   * Handle CLOSE message (unsubscribe)
   */
  private handleClose(ws: WebSocket, subId: string): void {
    this.subscriptions.delete(subId);
    this.send(ws, ['CLOSED', subId, '']);
  }

  /**
   * Handle AUTH message (NIP-42)
   */
  private handleAuth(ws: WebSocket, event: NostrEvent): void {
    // Validate AUTH event
    if (event.kind !== 22242) {
      this.send(ws, ['NOTICE', 'Invalid AUTH event kind']);
      return;
    }

    // Check challenge tag
    const challengeTag = event.tags.find(t => t[0] === 'challenge');
    if (!challengeTag) {
      this.send(ws, ['NOTICE', 'Missing challenge in AUTH event']);
      return;
    }

    // Mark as authenticated
    this.authenticatedClients.add(ws);
    this.send(ws, ['OK', event.id, true, '']);
  }

  /**
   * Validate Nostr event structure
   */
  private validateEvent(event: NostrEvent): boolean {
    return !!(
      event.pubkey &&
      typeof event.created_at === 'number' &&
      typeof event.kind === 'number' &&
      Array.isArray(event.tags) &&
      typeof event.content === 'string'
    );
  }

  /**
   * Find events matching filters
   */
  private findMatchingEvents(filters: any[]): NostrEvent[] {
    const results: NostrEvent[] = [];

    for (const event of this.events.values()) {
      if (filters.some(filter => this.eventMatchesFilter(event, filter))) {
        results.push(event);
      }
    }

    return results.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Check if event matches filter
   */
  private eventMatchesFilter(event: NostrEvent, filter: any): boolean {
    // Check kinds
    if (filter.kinds && !filter.kinds.includes(event.kind)) {
      return false;
    }

    // Check authors
    if (filter.authors && !filter.authors.includes(event.pubkey)) {
      return false;
    }

    // Check IDs
    if (filter.ids && event.id && !filter.ids.includes(event.id)) {
      return false;
    }

    // Check tags
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith('#')) {
        const tagName = key.slice(1);
        const eventTags = event.tags.filter(t => t[0] === tagName).map(t => t[1]);

        if (!values || !Array.isArray(values)) continue;

        if (!values.some((v: string) => eventTags.includes(v))) {
          return false;
        }
      }
    }

    // Check since
    if (filter.since && event.created_at < filter.since) {
      return false;
    }

    // Check until
    if (filter.until && event.created_at > filter.until) {
      return false;
    }

    return true;
  }

  /**
   * Broadcast event to subscribers
   */
  private broadcastEvent(event: NostrEvent): void {
    if (!this.wss) return;

    for (const [subId, filters] of this.subscriptions.entries()) {
      if (filters.some(filter => this.eventMatchesFilter(event, filter))) {
        this.wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            this.send(client, ['EVENT', subId, event]);
          }
        });
      }
    }
  }

  /**
   * Send message to WebSocket client
   */
  private send(ws: WebSocket, message: any[]): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check if client is authenticated
   */
  private isAuthenticated(ws: WebSocket): boolean {
    return !this.config.requireAuth || this.authenticatedClients.has(ws);
  }

  /**
   * Generate AUTH challenge
   */
  private generateChallenge(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Generate event ID
   */
  private generateEventId(event: NostrEvent): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Add a pre-existing event (for test setup)
   */
  addEvent(event: NostrEvent): void {
    const eventId = event.id || this.generateEventId(event);
    this.events.set(eventId, { ...event, id: eventId });
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events.clear();
  }

  /**
   * Get all stored events
   */
  getEvents(): NostrEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.size;
  }
}

/**
 * Create and start a mock relay for testing
 */
export async function createMockRelay(config: Partial<MockRelayConfig> = {}): Promise<MockNostrRelay> {
  const relay = new MockNostrRelay({
    port: config.port || 8080,
    requireAuth: config.requireAuth ?? false,
    adminPubkey: config.adminPubkey
  });

  await relay.start();
  return relay;
}
