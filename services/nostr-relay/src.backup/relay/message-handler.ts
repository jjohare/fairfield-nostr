/**
 * Nostr protocol message handler
 */
import { WebSocket } from 'ws';
import { NostrEvent, NostrFilter, NostrMessage, ClientSession } from '../types.js';
import { logger } from '../utils/logger.js';
import { verifyEventSignature } from '../utils/crypto.js';
import { db } from '../db/database.js';
import { SessionManager } from './session-manager.js';
import { config } from '../config.js';

export class MessageHandler {
  constructor(private sessionManager: SessionManager) {}

  async handleMessage(sessionId: string, rawMessage: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      logger.error('Session not found', { sessionId });
      return;
    }

    this.sessionManager.updateActivity(sessionId);

    let message: NostrMessage;
    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      this.sendNotice(session.ws, 'Invalid JSON');
      return;
    }

    if (!Array.isArray(message) || message.length === 0) {
      this.sendNotice(session.ws, 'Invalid message format');
      return;
    }

    const [type, ...args] = message;

    try {
      switch (type) {
        case 'EVENT':
          await this.handleEvent(session, args[0]);
          break;
        case 'REQ':
          await this.handleReq(session, args[0], args.slice(1));
          break;
        case 'CLOSE':
          await this.handleClose(session, args[0]);
          break;
        case 'AUTH':
          await this.handleAuth(session, args[0]);
          break;
        default:
          this.sendNotice(session.ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error('Error handling message', { sessionId, type, error });
      this.sendNotice(session.ws, 'Internal error processing message');
    }
  }

  private async handleEvent(session: ClientSession, event: NostrEvent): Promise<void> {
    // Rate limiting
    if (!this.sessionManager.checkRateLimit(session.id, 'events')) {
      this.sendOK(session.ws, event.id, false, 'rate-limited: slow down');
      return;
    }

    // Validation
    const validation = this.validateEvent(event);
    if (!validation.valid) {
      this.sendOK(session.ws, event.id, false, validation.error!);
      return;
    }

    // Auth required check
    if (config.authRequired && !this.sessionManager.isAuthenticated(session.id, event.pubkey)) {
      this.sendOK(session.ws, event.id, false, 'auth-required: please authenticate first');
      return;
    }

    // Signature verification
    const isValid = await verifyEventSignature(event);
    if (!isValid) {
      this.sendOK(session.ws, event.id, false, 'invalid: signature verification failed');
      return;
    }

    // Cohort access check
    if (config.cohortAccessEnabled) {
      const hasAccess = await db.isPubkeyInCohort(event.pubkey, 'public');
      if (!hasAccess) {
        this.sendOK(session.ws, event.id, false, 'blocked: not in allowed cohort');
        return;
      }

      const kindAllowed = await db.isKindAllowedInCohort(event.kind, 'public');
      if (!kindAllowed) {
        this.sendOK(session.ws, event.id, false, `blocked: kind ${event.kind} not allowed`);
        return;
      }
    }

    // Handle deletion events (NIP-09)
    if (event.kind === 5 && config.features.deletion) {
      await this.handleDeletion(event);
      this.sendOK(session.ws, event.id, true, '');
      return;
    }

    // Store event
    const stored = await db.storeEvent(event);
    if (stored) {
      this.sendOK(session.ws, event.id, true, '');
      // Broadcast to other clients with matching subscriptions
      this.broadcastEvent(event, session.id);
    } else {
      this.sendOK(session.ws, event.id, false, 'duplicate: event already exists');
    }
  }

  private async handleReq(
    session: ClientSession,
    subscriptionId: string,
    filters: NostrFilter[]
  ): Promise<void> {
    // Rate limiting
    if (!this.sessionManager.checkRateLimit(session.id, 'reqs')) {
      this.sendClosed(session.ws, subscriptionId, 'rate-limited: slow down');
      return;
    }

    // Validation
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      this.sendClosed(session.ws, subscriptionId || '', 'invalid: subscription ID required');
      return;
    }

    if (!filters || filters.length === 0) {
      this.sendClosed(session.ws, subscriptionId, 'invalid: at least one filter required');
      return;
    }

    if (filters.length > config.eventLimits.maxFilters) {
      this.sendClosed(
        session.ws,
        subscriptionId,
        `invalid: too many filters (max ${config.eventLimits.maxFilters})`
      );
      return;
    }

    // Auth check
    if (config.authRequired && !this.sessionManager.isAuthenticated(session.id)) {
      this.sendClosed(session.ws, subscriptionId, 'auth-required: please authenticate first');
      return;
    }

    // Add subscription
    const added = this.sessionManager.addSubscription(session.id, subscriptionId, filters);
    if (!added) {
      this.sendClosed(session.ws, subscriptionId, 'error: max subscriptions reached');
      return;
    }

    // Query events
    try {
      const events = await db.queryEvents(filters);

      // Send matching events
      for (const event of events) {
        this.sendEvent(session.ws, subscriptionId, event);
      }

      // Send EOSE
      this.sendEOSE(session.ws, subscriptionId);
    } catch (error) {
      logger.error('Error querying events', { sessionId: session.id, subscriptionId, error });
      this.sendClosed(session.ws, subscriptionId, 'error: failed to query events');
    }
  }

  private async handleClose(session: ClientSession, subscriptionId: string): Promise<void> {
    const removed = this.sessionManager.removeSubscription(session.id, subscriptionId);
    if (removed) {
      this.sendClosed(session.ws, subscriptionId, 'subscription closed');
    }
  }

  private async handleAuth(session: ClientSession, event: NostrEvent): Promise<void> {
    if (event.kind !== 22242) {
      this.sendOK(session.ws, event.id, false, 'invalid: auth event must be kind 22242');
      return;
    }

    // Verify signature
    const isValid = await verifyEventSignature(event);
    if (!isValid) {
      this.sendOK(session.ws, event.id, false, 'invalid: signature verification failed');
      return;
    }

    // Check challenge
    const challengeTag = event.tags.find((tag) => tag[0] === 'challenge');
    if (!challengeTag || challengeTag[1] !== session.challenge) {
      this.sendOK(session.ws, event.id, false, 'invalid: challenge mismatch');
      return;
    }

    // Check timestamp
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - event.created_at);
    if (timeDiff > 600) {
      this.sendOK(session.ws, event.id, false, 'invalid: timestamp too old');
      return;
    }

    // Authenticate
    this.sessionManager.authenticate(session.id, event.pubkey);
    this.sendOK(session.ws, event.id, true, '');

    logger.info('Client authenticated', {
      sessionId: session.id,
      pubkey: event.pubkey,
    });
  }

  private async handleDeletion(event: NostrEvent): Promise<void> {
    const deletedEventIds = event.tags.filter((tag) => tag[0] === 'e').map((tag) => tag[1]);

    for (const eventId of deletedEventIds) {
      await db.deleteEvent(eventId, event.pubkey);
    }

    logger.info('Events deleted', {
      deleterPubkey: event.pubkey,
      count: deletedEventIds.length,
    });
  }

  private validateEvent(event: NostrEvent): { valid: boolean; error?: string } {
    if (!event || typeof event !== 'object') {
      return { valid: false, error: 'invalid: event must be an object' };
    }

    if (!event.id || !event.pubkey || !event.sig) {
      return { valid: false, error: 'invalid: missing required fields' };
    }

    if (typeof event.kind !== 'number') {
      return { valid: false, error: 'invalid: kind must be a number' };
    }

    if (!Array.isArray(event.tags)) {
      return { valid: false, error: 'invalid: tags must be an array' };
    }

    if (typeof event.content !== 'string') {
      return { valid: false, error: 'invalid: content must be a string' };
    }

    // Time limits
    if (event.created_at < config.timeLimits.createdAtLower) {
      return { valid: false, error: 'invalid: created_at too far in the past' };
    }

    if (event.created_at > config.timeLimits.createdAtUpper) {
      return { valid: false, error: 'invalid: created_at too far in the future' };
    }

    // Size limits
    const eventSize = JSON.stringify(event).length;
    if (eventSize > config.eventLimits.maxSize) {
      return { valid: false, error: 'invalid: event too large' };
    }

    return { valid: true };
  }

  private broadcastEvent(event: NostrEvent, excludeSessionId: string): void {
    // Find all sessions with matching subscriptions
    const sessions = this.sessionManager['sessions'];
    for (const [sessionId, session] of sessions) {
      if (sessionId === excludeSessionId) continue;

      for (const [subId, filters] of session.subscriptions) {
        if (this.eventMatchesFilters(event, filters)) {
          this.sendEvent(session.ws, subId, event);
        }
      }
    }
  }

  private eventMatchesFilters(event: NostrEvent, filters: NostrFilter[]): boolean {
    return filters.some((filter) => this.eventMatchesFilter(event, filter));
  }

  private eventMatchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
    if (filter.ids && !filter.ids.includes(event.id)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;

    // Check tag filters
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith('#') && Array.isArray(values)) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags
          .filter((tag) => tag[0] === tagName)
          .map((tag) => tag[1]);

        const hasMatch = values.some((v) => eventTagValues.includes(v));
        if (!hasMatch) return false;
      }
    }

    return true;
  }

  // Protocol messages
  private sendOK(ws: WebSocket, eventId: string, accepted: boolean, message: string): void {
    this.send(ws, ['OK', eventId, accepted, message]);
  }

  private sendEvent(ws: WebSocket, subscriptionId: string, event: NostrEvent): void {
    this.send(ws, ['EVENT', subscriptionId, event]);
  }

  private sendEOSE(ws: WebSocket, subscriptionId: string): void {
    this.send(ws, ['EOSE', subscriptionId]);
  }

  private sendClosed(ws: WebSocket, subscriptionId: string, message: string): void {
    this.send(ws, ['CLOSED', subscriptionId, message]);
  }

  private sendNotice(ws: WebSocket, message: string): void {
    this.send(ws, ['NOTICE', message]);
  }

  private send(ws: WebSocket, message: NostrMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error('Failed to send message', { error });
    }
  }
}
