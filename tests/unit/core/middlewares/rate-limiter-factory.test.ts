import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { RateLimiterFactory } from '../../../../src/core/middlewares/RateLimiterFactory.js';
import { createFakeLogger } from '../../../helpers/fakes.js';

const PROFILES = {
  TINY: { windowMs: 30_000, maxRequests: 2 },
  CUSTOM: { windowMs: 1_000, maxRequests: 1, message: 'Slow down!' },
};

function buildApp(key: keyof typeof PROFILES) {
  const logger = createFakeLogger();
  const app = express();
  app.use(new RateLimiterFactory(logger, PROFILES).create(key));
  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });
  return { app, logger };
}

describe('RateLimiterFactory', () => {
  it('allows requests up to the configured limit', async () => {
    const { app } = buildApp('TINY');
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(200);
  });

  it('answers 429 JSON with rate-limit headers once exceeded, and logs it', async () => {
    const { app, logger } = buildApp('TINY');
    await request(app).get('/');
    await request(app).get('/');
    const res = await request(app).get('/');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: 'Too many requests, please try again later.',
    });
    expect(res.headers['retry-after']).toBe('30');
    expect(res.headers['ratelimit-limit']).toBe('2');
    expect(res.headers['ratelimit-remaining']).toBe('0');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[TINY]'));
  });

  it('uses the profile-specific message when provided', async () => {
    const { app } = buildApp('CUSTOM');
    await request(app).get('/');
    const res = await request(app).get('/');
    expect(res.status).toBe(429);
    expect(res.body.message).toBe('Slow down!');
    expect(res.headers['retry-after']).toBe('1');
  });

  it('keeps separate counters per created limiter', async () => {
    const { app: a } = buildApp('CUSTOM');
    const { app: b } = buildApp('CUSTOM');
    await request(a).get('/');
    expect((await request(b).get('/')).status).toBe(200);
  });
});
