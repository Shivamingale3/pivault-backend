import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { sha256Hex } from '../../src/core/crypto/hash.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import { ONBOARDING_LINK_HOURS } from '../../src/modules/passwordReset/passwordReset.constants.js';
import { CapturingEmailSender } from '../helpers/CapturingEmailSender.js';
import { db, truncateUsers } from '../helpers/db.js';

/**
 * Full stack: HTTP → validation → service → real Postgres → (captured) email.
 * Keep this file under the register rate limit (RATE_LIMITS.REGISTER) requests.
 */
const emailSender = new CapturingEmailSender();
const container = createContainer({ logger: new NoopLogger(), emailSender });
const REGISTER = '/api/internal/register';

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
beforeEach(async () => {
  await truncateUsers();
  emailSender.sent.length = 0;
  emailSender.failWith = null;
});
afterAll(async () => {
  await truncateUsers();
  await container.resources.disconnectAll();
});

describe('register → welcome email', () => {
  it('creates the user, emails a set-password link and stores only the token hash', async () => {
    const res = await request(container.app).post(REGISTER).send(body());
    expect(res.status).toBe(201);

    expect(emailSender.sent).toHaveLength(1);
    const [mail] = emailSender.sent;
    expect(mail?.to).toBe('jane@example.com');
    const link = new URL(mail?.variables.resetUrl ?? '');
    expect(link.pathname).toBe('/reset-password');
    const key = link.searchParams.get('key') ?? '';
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const user = await db.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    const token = await db.passwordResetToken.findUniqueOrThrow({ where: { userId: user.id } });
    expect(token.tokenHash).toBe(sha256Hex(key));
    expect(token.purpose).toBe('onboarding');
    const hoursLeft = (token.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(ONBOARDING_LINK_HOURS - 0.1);
    expect(hoursLeft).toBeLessThanOrEqual(ONBOARDING_LINK_HOURS);
    expect(JSON.stringify(token)).not.toContain(key);
  });

  it('rolls everything back with a 502 when the email cannot be sent, then can be retried', async () => {
    emailSender.failWith = new Error('smtp down');
    const failed = await request(container.app).post(REGISTER).send(body());
    expect(failed.status).toBe(502);
    expect(JSON.stringify(failed.body)).not.toContain('smtp down');
    expect(await db.user.count()).toBe(0);
    expect(await db.passwordResetToken.count()).toBe(0);

    emailSender.failWith = null;
    const retry = await request(container.app).post(REGISTER).send(body());
    expect(retry.status).toBe(201);
    expect(await db.user.count()).toBe(1);
  });

  it('returns 409 for a duplicate and sends no second email', async () => {
    await request(container.app).post(REGISTER).send(body());
    const dup = await request(container.app).post(REGISTER).send(body());
    expect(dup.status).toBe(409);
    expect(emailSender.sent).toHaveLength(1);
  });
});

describe('health', () => {
  it('reports readiness from Postgres alone', async () => {
    const res = await request(container.app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ database: true });
  });
});
