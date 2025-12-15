/**
 * Session management for WebSocket connections
 */
import { WebSocket } from 'ws';
import { ClientSession, RateLimitConfig, RateLimitState } from '../types.js';
import { logger } from '../utils/logger.js';
import { generateChallenge } from '../utils/crypto.js';
import { config } from '../config.js';

export class SessionManager {
  private sessions: Map<string, ClientSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup inactive sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  createSession(ws: WebSocket): ClientSession {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: ClientSession = {
      id: sessionId,
      ws,
      subscriptions: new Map(),
      authenticatedPubkeys: new Set(),
      challenge: config.authRequired ? generateChallenge() : undefined,
      connectedAt: now,
      lastActivity: now,
      rateLimits: {
        events: this.createRateLimitState(config.rateLimits.events),
        reqs: this.createRateLimitState(config.rateLimits.reqs),
      },
    };

    this.sessions.set(sessionId, session);
    logger.info('Session created', { sessionId });

    return session;
  }

  getSession(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ws.close();
      this.sessions.delete(sessionId);
      logger.info('Session destroyed', { sessionId });
    }
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  addSubscription(sessionId: string, subscriptionId: string, filters: any[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.subscriptions.size >= config.eventLimits.maxSubscriptions) {
      logger.warn('Max subscriptions reached', { sessionId });
      return false;
    }

    session.subscriptions.set(subscriptionId, filters);
    logger.debug('Subscription added', { sessionId, subscriptionId });
    return true;
  }

  removeSubscription(sessionId: string, subscriptionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      logger.debug('Subscription removed', { sessionId, subscriptionId });
    }
    return deleted;
  }

  authenticate(sessionId: string, pubkey: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.authenticatedPubkeys.add(pubkey);
      logger.info('Session authenticated', { sessionId, pubkey });
    }
  }

  isAuthenticated(sessionId: string, pubkey?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!pubkey) {
      return session.authenticatedPubkeys.size > 0;
    }

    return session.authenticatedPubkeys.has(pubkey);
  }

  checkRateLimit(sessionId: string, type: 'events' | 'reqs'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const rateLimitState = session.rateLimits[type];
    const rateConfig = config.rateLimits[type];

    this.refillTokens(rateLimitState, rateConfig);

    if (rateLimitState.tokens < 1) {
      logger.warn('Rate limit exceeded', { sessionId, type });
      return false;
    }

    rateLimitState.tokens -= 1;
    return true;
  }

  broadcastToSubscription(subscriptionId: string, event: any): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.subscriptions.has(subscriptionId)) {
        try {
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify(event));
          }
        } catch (error) {
          logger.error('Failed to broadcast event', { sessionId, error });
        }
      }
    }
  }

  broadcastToAll(event: any, excludeSessionId?: string): void {
    for (const [sessionId, session] of this.sessions) {
      if (sessionId === excludeSessionId) continue;

      try {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify(event));
        }
      } catch (error) {
        logger.error('Failed to broadcast event', { sessionId, error });
      }
    }
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getSessionStats() {
    let totalSubscriptions = 0;
    let authenticatedCount = 0;

    for (const session of this.sessions.values()) {
      totalSubscriptions += session.subscriptions.size;
      if (session.authenticatedPubkeys.size > 0) {
        authenticatedCount++;
      }
    }

    return {
      total: this.sessions.size,
      authenticated: authenticatedCount,
      subscriptions: totalSubscriptions,
    };
  }

  private createRateLimitState(config: RateLimitConfig): RateLimitState {
    return {
      tokens: config.capacity,
      lastRefill: Date.now(),
    };
  }

  private refillTokens(state: RateLimitState, config: RateLimitConfig): void {
    const now = Date.now();
    const elapsed = now - state.lastRefill;
    const tokensToAdd = (elapsed / (config.rate * 1000)) * config.capacity;

    state.tokens = Math.min(config.capacity, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    const toDelete: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > timeout) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      this.destroySession(sessionId);
    }

    if (toDelete.length > 0) {
      logger.info('Cleaned up inactive sessions', { count: toDelete.length });
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }
  }
}
