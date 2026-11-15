import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createContainer } from '../../src/container.js';
import { Argon2PasswordHasher } from '../../src/core/crypto/Argon2PasswordHasher.js';
import { sha256Hex } from '../../src/core/crypto/hash.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from '../../src/modules/auth/auth.constants.js';
import { CapturingEmailSender } from '../helpers/CapturingEmailSender.js';
import { db, truncateUsers } from '../helpers/db.js';
import { createDevice } from '../helpers/deviceKey.js';

/**
 * Login, logout and forgot-password through the real stack and Postgres. Every call uses its own
 * X-Forwarded-For so the per-IP limiters never interfere with each other.
 */
const emailSender = new CapturingEmailSender();
const container = createContainer({ logger: new NoopLogger(), emailSender });
const LOGIN = '/api/auth/login';
const LOGOUT = '/api/auth/logout';
const FORGOT = '/api/auth/forgot-password';
const RECOVERY = '/api/auth/recovery-key-configured';
const EMAIL = 'jane@example.com';
const PASSWORD = 'Passw0rd!';

let ipCounter = 0;
const nextIp = (): string => `198.51.100.${++ipCounter}`;
const post = (path: string) => request(container.app).post(path).set('X-Forwarded-For', nextIp());

let passwordHash: string;
const createUser = (
  overrides: { email?: string; mobile?: string; emailVerifiedAt?: Date | null } = {},
) =>
  db.user.create({
    data: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: EMAIL,
      countryCode: '91',
      mobile: '9876543210',
      passwordHash,
      emailVerifiedAt: new Date(),
      ...overrides,
    },
  });

async function signIn(device = createDevice(), password = PASSWORD, email = EMAIL) {
  const res = await post(LOGIN).send({ email, password, publicKey: device.publicKey });
  return { res, device, token: (res.body.data?.token ?? '') as string };
}

beforeAll(async () => {
  passwordHash = await new Argon2PasswordHasher().hash(PASSWORD);
  await container.resources.connectAll();
});
beforeEach(async () => {
  await truncateUsers();
  await db.passwordResetToken.deleteMany({});
  emailSender.sent.length = 0;
});
afterAll(async () => {
  await truncateUsers();
  await container.resources.disconnectAll();
});

describe('POST /api/auth/login', () => {
  it('signs in: returns the token once, stores only its hash and the device key', async () => {
    const user = await createUser();
    const { res, device, token } = await signIn();

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toMatchObject({
      user: { id: user.id, email: EMAIL, firstName: 'Jane', lastName: 'Doe' },
      recoveryKeyConfigured: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const session = await db.session.findUniqueOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).toBe(sha256Hex(token));
    expect(session.publicKey).toBe(device.publicKey);
    expect(JSON.stringify(session)).not.toContain(token);
  });

  it('reports a configured recovery key', async () => {
    await createUser();
    await db.user.updateMany({ data: { recoveryKeyConfiguredAt: new Date() } });
    expect((await signIn()).res.body.data.recoveryKeyConfigured).toBe(true);
  });

  it('a second login replaces the first session, which then stops working', async () => {
    await createUser();
    const first = await signIn();
    const second = await signIn();

    expect(await db.session.count()).toBe(1);
    const stale = await post(LOGOUT).set(first.device.signedHeaders(first.token, 'POST', LOGOUT));
    expect(stale.status).toBe(401);
    const fresh = await post(LOGOUT).set(second.device.signedHeaders(second.token, 'POST', LOGOUT));
    expect(fresh.status).toBe(200);
  });

  it('answers a wrong password and an unknown email the same way', async () => {
    await createUser();
    const wrong = await signIn(createDevice(), 'Wr0ng-pass!');
    const unknown = await post(LOGIN).send({
      email: 'ghost@example.com',
      password: PASSWORD,
      publicKey: createDevice().publicKey,
    });
    for (const res of [wrong.res, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    }
    expect(await db.session.count()).toBe(0);
  });

  it('refuses a user who has not verified their email', async () => {
    await createUser({ emailVerifiedAt: null });
    const { res } = await signIn();
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(EMAIL_NOT_VERIFIED_MESSAGE);
    expect(await db.session.count()).toBe(0);
  });

  it('locks the account after repeated wrong passwords, even for the right one', async () => {
    // Own email: the throttle lives in the container and would otherwise outlast this test.
    const email = 'locked@example.com';
    await createUser({ email, mobile: '9876543211' });
    for (let i = 0; i < 5; i += 1) await signIn(createDevice(), 'Wr0ng-pass!', email);
    expect((await signIn(createDevice(), PASSWORD, email)).res.status).toBe(429);
  });

  it('rejects a malformed body and a bad device key with 400', async () => {
    await createUser();
    expect((await post(LOGIN).send({ email: EMAIL, password: PASSWORD })).status).toBe(400);
    const badKey = await post(LOGIN).send({ email: EMAIL, password: PASSWORD, publicKey: 'AAAA' });
    expect(badKey.status).toBe(400);
    expect(await db.session.count()).toBe(0);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session when the request is signed by the session device', async () => {
    await createUser();
    const { device, token } = await signIn();
    const res = await post(LOGOUT).set(device.signedHeaders(token, 'POST', LOGOUT));
    expect(res.status).toBe(200);
    expect(await db.session.count()).toBe(0);
  });

  it('refuses a bearer token without the device signature, or with another device signature', async () => {
    await createUser();
    const { token } = await signIn();
    const bare = await post(LOGOUT).set('Authorization', `Bearer ${token}`);
    const other = await post(LOGOUT).set(createDevice().signedHeaders(token, 'POST', LOGOUT));
    expect([bare.status, other.status]).toEqual([401, 401]);
    expect(await db.session.count()).toBe(1);
  });
});

describe('POST /api/auth/recovery-key-configured', () => {
  it('records that the device has a recovery key, and login then reports it', async () => {
    const user = await createUser();
    const { device, token } = await signIn();
    const res = await post(RECOVERY).set(device.signedHeaders(token, 'POST', RECOVERY));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.recoveryKeyConfiguredAt).not.toBeNull();
    expect((await signIn()).res.body.data.recoveryKeyConfigured).toBe(true);
  });

  it('needs a signed session', async () => {
    await createUser();
    const { token } = await signIn();
    const bare = await post(RECOVERY).set('Authorization', `Bearer ${token}`);
    expect(bare.status).toBe(401);
    expect((await post(RECOVERY)).status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('emails a reset link; using it sets the password and ends the session', async () => {
    await createUser();
    await signIn();

    const res = await post(FORGOT).send({ email: EMAIL });
    expect(res.status).toBe(200);
    const mail = emailSender.sent.at(-1);
    expect(mail).toMatchObject({ to: EMAIL, template: 'password-reset' });
    const url = new URL(mail?.variables['resetUrl'] ?? '');
    expect(url.pathname).toBe('/reset-password');

    const token = url.searchParams.get('key') ?? '';
    const complete = await post('/api/auth/password-links/complete').send({
      token,
      password: 'Brand-new1!',
    });
    expect(complete.status).toBe(200);
    expect(await db.session.count()).toBe(0);
    expect((await signIn(createDevice(), 'Brand-new1!')).res.status).toBe(200);
  });

  it('tells the caller when the email is unknown and sends nothing', async () => {
    const res = await post(FORGOT).send({ email: 'ghost@example.com' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ACCOUNT_NOT_FOUND_MESSAGE);
    expect(emailSender.sent).toHaveLength(0);
  });

  it('is rate limited per IP', async () => {
    await createUser();
    const ip = nextIp();
    const call = () =>
      request(container.app).post(FORGOT).set('X-Forwarded-For', ip).send({ email: EMAIL });
    const statuses = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await call()).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});
