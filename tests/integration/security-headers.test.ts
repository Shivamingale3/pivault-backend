import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';

/**
 * Every API response must carry the security headers (see "Security headers" in AGENTS.md),
 * whatever path produced it. Add a case here when you add a new kind of response path.
 */
const container = createContainer({ logger: new NoopLogger() });
const { app } = container;

const REQUIRED = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'cross-origin-opener-policy',
] as const;

const expectSecurityHeaders = (headers: Record<string, unknown>): void => {
  for (const name of REQUIRED) expect(headers).toHaveProperty(name);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-powered-by']).toBeUndefined();
  expect(String(headers['content-security-policy'])).toContain("object-src 'none'");
  expect(String(headers['content-security-policy'])).not.toMatch(
    /unsafe-eval|script-src[^;]*'unsafe-inline'/,
  );
};

beforeAll(() => container.resources.connectAll());
afterAll(() => container.resources.disconnectAll());

describe('security headers on every response path', () => {
  it('liveness (200)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expectSecurityHeaders(res.headers);
  });

  it('readiness (200)', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expectSecurityHeaders(res.headers);
  });

  it('unknown API route (404)', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expectSecurityHeaders(res.headers);
  });

  it('route outside the API prefix (404)', async () => {
    const res = await request(app).get('/anything');
    expect(res.status).toBe(404);
    expectSecurityHeaders(res.headers);
  });

  it('malformed JSON body (400)', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expectSecurityHeaders(res.headers);
  });

  it('validation error on a real route (400)', async () => {
    const res = await request(app).post('/api/internal/register').send({});
    expect(res.status).toBe(400);
    expectSecurityHeaders(res.headers);
  });

  it.each(['validate', 'complete'])('public password-link route: %s (400)', async (action) => {
    const res = await request(app).post(`/api/auth/password-links/${action}`).send({});
    expect(res.status).toBe(400);
    expect(res.headers['cache-control']).toBe('no-store');
    expectSecurityHeaders(res.headers);
  });

  it('CORS preflight (204)', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expectSecurityHeaders(res.headers);
  });

  it('rate-limited response (429)', async () => {
    let last = await request(app).get('/api/health');
    for (let i = 0; i < 70 && last.status !== 429; i += 1) {
      last = await request(app).get('/api/health');
    }
    expect(last.status).toBe(429);
    expectSecurityHeaders(last.headers);
  });
});
