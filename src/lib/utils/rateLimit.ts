/**
 * Client-side Rate Limiting
 *
 * Implements token bucket algorithm to prevent abuse and spam.
 * Works in conjunction with relay-side rate limiting.
 */

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum tokens in bucket */
  capacity: number;
  /** Tokens added per second */
  refillRate: number;
  /** Tokens consumed per action */
  tokensPerAction: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /** Message sending: 10 per minute */
  message: {
    capacity: 10,
    refillRate: 10 / 60, // 10 per minute
    tokensPerAction: 1
  },
  /** Channel creation: 2 per hour */
  channelCreate: {
    capacity: 2,
    refillRate: 2 / 3600, // 2 per hour
    tokensPerAction: 1
  },
  /** DM sending: 20 per minute */
  dm: {
    capacity: 20,
    refillRate: 20 / 60,
    tokensPerAction: 1
  },
  /** API calls: 100 per minute */
  api: {
    capacity: 100,
    refillRate: 100 / 60,
    tokensPerAction: 1
  },
  /** Login attempts: 5 per 15 minutes */
  login: {
    capacity: 5,
    refillRate: 5 / 900, // 5 per 15 minutes
    tokensPerAction: 1
  }
} as const;

/**
 * Rate limiter class using token bucket algorithm
 */
class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if action is allowed and consume tokens if so
   * @param key - Unique key for this rate limit (e.g., user ID, action type)
   * @returns Object with allowed status and time until next token
   */
  check(key: string): { allowed: boolean; retryAfter: number; remaining: number } {
    const now = Date.now() / 1000;
    let bucket = this.buckets.get(key);

    // Initialize bucket if doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.config.capacity,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * this.config.refillRate;
    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if action is allowed
    if (bucket.tokens >= this.config.tokensPerAction) {
      bucket.tokens -= this.config.tokensPerAction;
      return {
        allowed: true,
        retryAfter: 0,
        remaining: Math.floor(bucket.tokens)
      };
    }

    // Calculate time until enough tokens
    const tokensNeeded = this.config.tokensPerAction - bucket.tokens;
    const retryAfter = Math.ceil(tokensNeeded / this.config.refillRate);

    return {
      allowed: false,
      retryAfter,
      remaining: 0
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Get remaining tokens for a key
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.config.capacity;

    const now = Date.now() / 1000;
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * this.config.refillRate;
    return Math.min(this.config.capacity, Math.floor(bucket.tokens + tokensToAdd));
  }
}

// Create rate limiters for different actions
const rateLimiters = {
  message: new RateLimiter(RATE_LIMITS.message),
  channelCreate: new RateLimiter(RATE_LIMITS.channelCreate),
  dm: new RateLimiter(RATE_LIMITS.dm),
  api: new RateLimiter(RATE_LIMITS.api),
  login: new RateLimiter(RATE_LIMITS.login)
};

/**
 * Check rate limit for an action
 * @param action - Type of action
 * @param key - Unique key (e.g., user pubkey)
 */
export function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  key: string = 'default'
): { allowed: boolean; retryAfter: number; remaining: number } {
  const limiter = rateLimiters[action];
  return limiter.check(key);
}

/**
 * Get remaining rate limit quota
 */
export function getRateLimitRemaining(
  action: keyof typeof RATE_LIMITS,
  key: string = 'default'
): number {
  const limiter = rateLimiters[action];
  return limiter.getRemaining(key);
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(
  action: keyof typeof RATE_LIMITS,
  key: string = 'default'
): void {
  const limiter = rateLimiters[action];
  limiter.reset(key);
}

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  action: keyof typeof RATE_LIMITS,
  keyFn: (...args: Parameters<T>) => string = () => 'default'
) {
  return function (fn: T): T {
    return (async function (...args: Parameters<T>) {
      const key = keyFn(...args);
      const { allowed, retryAfter } = checkRateLimit(action, key);

      if (!allowed) {
        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter
        );
      }

      return fn(...args);
    }) as T;
  };
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
