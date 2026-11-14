import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { RATE_LIMITS } from '../../src/core/constants/ratelimits.constants.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import { INVALID_LINK_MESSAGE } from '../../src/modules/passwordLink/passwordLink.constants.js';
import { CapturingEmailSender } from '../helpers/CapturingEmailSender.js';
import { db, truncateUsers } from '../helpers/db.js';

/**
 * Full stack for the emailed link: register → mail → validate → complete, against real Postgres.
 * Each call uses its own X-Forwarded-For so the per-IP limiters do not interfere; keep the
 * number of registrations in this file at or under RATE_LIMITS.REGISTER.
 */
const emailSender = new CapturingEmailSender();
const container = createContainer({ logger: new NoopLogger(), emailSender });
const VALIDATE = '/api/auth/password-links/validate';
const COMPLETE = '/api/auth/password-links/complete';
const NEW_PASSWORD = 'Brand-new1!';

let ipCounter = 0;
const nextIp = (): string => `198.51.100.${++ipCounter}`;
const validate = (token: string, ip = nextIp()) =>
  request(container.app).post(VALIDATE).set('X-Forwarded-For', ip).send({ token });
const complete = (token: string, password = NEW_PASSWORD, ip = nextIp()) =>
  request(container.app).post(COMPLETE).set('X-Forwarded-For', ip).send({ token, password });

/** Registers Jane and returns the token from the (captured) welcome email link. */
async function registerAndGetToken(): Promise<string> {
  const res = await request(container.app).post('/api/internal/register').send({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    countryCode: '+91',
    mobile: '9876543210',
    password: 'Passw0rd!',
  });
  expect(res.status).toBe(201);
  const mail = emailSender.sent.at(-1);
  return new URL(mail?.variables.resetUrl ?? '').searchParams.get('key') ?? '';
}

beforeAll(() => container.resources.connectAll());
beforeEach(async () => {
  await truncateUsers();
  emailSender.sent.length = 0;
});
afterAll(async () => {
  await truncateUsers();
  await container.resources.disconnectAll();
});

describe('welcome link → set password + verify email', () => {
  it('validates the link, sets the password, verifies the email and spends the token', async () => {
    const token = await registerAndGetToken();
    const before = await db.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    expect(before.emailVerifiedAt).toBeNull();

    const checked = await validate(token);
    expect(checked.status).toBe(200);
    expect(checked.body.data).toMatchObject({ purpose: 'onboarding' });
    expect(checked.headers['cache-control']).toBe('no-store');

    const done = await complete(token);
    expect(done.status).toBe(200);
    expect(done.body.data).toEqual({ emailVerified: true });
    expect(done.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(done.body)).not.toContain(token);
    expect(JSON.stringify(done.body)).not.toContain(NEW_PASSWORD);

    const after = await db.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.passwordChangedAt).not.toBeNull();
    expect(after.passwordHash).toMatch(/^\$argon2id\$/);
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await db.passwordResetToken.count()).toBe(0);

    const replay = await complete(token, 'Another-1pw!');
    expect(replay.status).toBe(400);
    expect(replay.body.message).toBe(INVALID_LINK_MESSAGE);
    expect((await validate(token)).status).toBe(400);
    expect(
      (await db.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } })).passwordHash,
    ).toBe(after.passwordHash);
  });

  it('rejects a weak password without spending the link', async () => {
    const token = await registerAndGetToken();
    const weak = await complete(token, 'weakpass');
    expect(weak.status).toBe(400);
    expect(weak.body.message).toMatch(/^Password /);
    expect(await db.passwordResetToken.count()).toBe(1);
    expect((await complete(token)).status).toBe(200);
  });

  it('answers unknown, malformed and expired links identically', async () => {
    const token = await registerAndGetToken();
    await db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const responses = await Promise.all([
      validate(token),
      validate('A'.repeat(43)),
      validate('short'),
      complete(token),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: INVALID_LINK_MESSAGE });
    }
    expect((await db.user.findFirstOrThrow()).emailVerifiedAt).toBeNull();
  });

  it('lets only one of two simultaneous submits win', async () => {
    const token = await registerAndGetToken();
    const results = await Promise.all([complete(token), complete(token, 'Second-pw1!')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('signs the user out of their existing session', async () => {
    const token = await registerAndGetToken();
    const user = await db.user.findFirstOrThrow();
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: 's'.repeat(64),
        publicKey: 'pk',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await complete(token);
    expect(await db.session.count()).toBe(0);
  });

  it('rate limits completion per client', async () => {
    const ip = nextIp();
    const limit = RATE_LIMITS.PASSWORD_LINK_COMPLETE.maxRequests;
    for (let i = 0; i < limit; i += 1) {
      expect((await complete('A'.repeat(43), NEW_PASSWORD, ip)).status).toBe(400);
    }
    const blocked = await complete('A'.repeat(43), NEW_PASSWORD, ip);
    expect(blocked.status).toBe(429);
    expect((await complete('A'.repeat(43), NEW_PASSWORD, nextIp())).status).toBe(400);
  });
});
