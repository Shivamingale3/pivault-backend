import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';

/** CORS is limited to the PWA's own origin (APP_URL); the test env falls back to the Vite dev URL. */
const container = createContainer({ logger: new NoopLogger() });
const { app } = container;
const ALLOWED = new URL(container.config.appUrl).origin;
const OTHER = 'https://evil.example';

beforeAll(() => container.resources.connectAll());
afterAll(() => container.resources.disconnectAll());

describe('CORS', () => {
  it('lets the PWA origin read responses', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers.vary).toMatch(/Origin/i);
  });

  it('gives any other origin no CORS headers', async () => {
    const res = await request(app).get('/api/health').set('Origin', OTHER);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never answers with a wildcard', async () => {
    for (const origin of [ALLOWED, OTHER, 'null']) {
      const res = await request(app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    }
  });

  it('does not approve a preflight from another origin (no allow-origin, so the browser refuses it)', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', OTHER)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('approves a preflight from the PWA origin', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('still serves requests without an Origin header (curl, same-origin)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
