import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import { db, truncateUsers } from '../helpers/db.js';

const container = createContainer({ logger: new NoopLogger() });
const URL = '/api/internal/register';

const body = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  countryCode: '+91',
  mobile: '9876543210',
  password: 'Passw0rd!',
  ...overrides,
});

beforeAll(() => container.resources.connectAll());
beforeEach(truncateUsers);
afterAll(async () => {
  await truncateUsers();
  await container.resources.disconnectAll();
});

describe('POST /api/internal/register', () => {
  it('registers a user: hashed password, mobile split in two columns', async () => {
    const res = await request(container.app).post(URL).send(body());

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.data)).toEqual(['user']);
    expect(res.body.data.user).toMatchObject({
      email: 'jane@example.com',
      countryCode: '91',
      mobile: '9876543210',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/Passw0rd|passwordHash|argon2/);

    const row = await db.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.countryCode).toBe('91');
    expect(row.mobile).toBe('9876543210');
    expect(await db.passwordResetToken.count({ where: { userId: row.id } })).toBe(1);
  });

  it('returns 409 for a duplicate email or mobile', async () => {
    await request(container.app).post(URL).send(body());

    const email = await request(container.app)
      .post(URL)
      .send(body({ mobile: '9876543211' }));
    expect(email.status).toBe(409);
    expect(email.body.message).toBe('Email already in use');

    const mobile = await request(container.app)
      .post(URL)
      .send(body({ email: 'b@example.com' }));
    expect(mobile.status).toBe(409);
    expect(mobile.body.message).toBe('Mobile number already in use');
  });

  it('returns 400 for invalid input and stores nothing', async () => {
    const res = await request(container.app)
      .post(URL)
      .send(body({ password: 'weak' }));
    expect(res.status).toBe(400);
    expect(await db.user.count()).toBe(0);
  });

  it('is invisible (404) to requests relayed by a proxy', async () => {
    const res = await request(container.app)
      .post(URL)
      .set('X-Forwarded-For', '203.0.113.9')
      .send(body());
    expect(res.status).toBe(404);
    expect(await db.user.count()).toBe(0);
  });
});
