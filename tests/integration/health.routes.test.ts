import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHealthModule } from '../../src/modules/health/health.module.js';
import { createTestContainer } from '../helpers/app.js';
import express from 'express';

const container = createTestContainer();
const { app } = container;

beforeAll(() => container.resources.connectAll());
afterAll(async () => {
  await container.resources.disconnectAll();
});

describe('GET /api/health', () => {
  it('returns 200 with success: true and a healthy message', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Server is healthy',
    });
  });

  it('returns the correct content-type', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toContain('application/json');
  });
});

describe('GET /api/health/ready', () => {
  it('is ready when Postgres, Redis and the queue answer', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ database: true, redis: true, 'queue:email': true });
  });

  it('returns 503 naming the dependency that is down', async () => {
    const isolated = express().use(
      '/health',
      createHealthModule(() => Promise.resolve({ database: true, redis: false })).getRouter(),
    );
    const res = await request(isolated).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      message: 'Server is not ready',
      data: { database: true, redis: false },
    });
  });
});

describe('Not Found handler', () => {
  it('returns 404 with success: false for unknown routes', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
    });
  });

  it('returns 404 for unknown top-level routes', async () => {
    const res = await request(app).get('/not-an-api-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Body parsing errors', () => {
  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Malformed JSON body' });
  });
});

describe('Security headers', () => {
  it('sets helmet headers on responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
