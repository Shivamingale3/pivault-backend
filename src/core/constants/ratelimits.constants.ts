export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const ONE_MINUTE_MS = 60 * 1000;

export const RATE_LIMIT_DEFAULT_MESSAGE = 'Too many requests, please try again later.';

/**
 * Named rate-limit profiles. Add a key here and call
 * `rateLimiterFactory.create(key)` to attach a route-specific limiter.
 */
export const RATE_LIMITS = {
  GLOBAL: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 60,
  },

  USER_WRITE: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 30,
    message: 'Too many user write requests. Please try again later.',
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitKey = keyof typeof RATE_LIMITS;
