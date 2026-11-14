import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { RATE_LIMITS } from '../../src/core/constants/ratelimits.constants.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';

/**
 * Rate limits are per real client. In production nginx on the Pi sets X-Forwarded-For to the single
 * client IP (see "Client IP" in AGENTS.md) and Express runs with `trust proxy` 1, so the limiter key
 * is the LAST X-Forwarded-For entry. Entries a client adds in front of it must not change its key.
 */
const container = createContainer({ logger: new NoopLogger() });
const { app } = container;
const LIMIT = RATE_LIMITS.GLOBAL.maxRequests;

const get = (forwardedFor: string) =>
  request(app).get('/api/health').set('X-Forwarded-For', forwardedFor);

beforeAll(() => container.resources.connectAll());
afterAll(() => container.resources.disconnectAll());

describe('rate limiting is keyed by the real client IP', () => {
  it('limits one client without affecting another, and ignores spoofed leading entries', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await get('198.51.100.7')).status).toBe(200);
    }
    expect((await get('198.51.100.7')).status).toBe(429);

    expect((await get('198.51.100.8')).status).toBe(200);
    // Pretending to be another client in front of the real one does not escape the limit.
    expect((await get('198.51.100.8, 198.51.100.7')).status).toBe(429);
    // And it does not borrow the other client's bucket either.
    expect((await get('198.51.100.7, 198.51.100.8')).status).toBe(200);
  });

  it('shares one bucket when the proxy appends its own address (the bug this guards against)', async () => {
    for (let i = 0; i < LIMIT; i += 1) await get('203.0.113.1, 127.0.0.1');
    expect((await get('203.0.113.2, 127.0.0.1')).status).toBe(429);
  });
});
