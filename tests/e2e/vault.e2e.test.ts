import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../../src/container.js';
import { Argon2PasswordHasher } from '../../src/core/crypto/Argon2PasswordHasher.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import { db, truncateUsers } from '../helpers/db.js';
import { createDevice } from '../helpers/deviceKey.js';
import { fakePassword } from '../helpers/passwords.js';
import { fakeState, nextVersion, toDocument } from '../helpers/vaultFixtures.js';
import type { VaultState } from '../../src/modules/vault/vault.types.js';

/**
 * The replication endpoints through the real stack and Postgres: signed sessions, RxDB's pull and
 * push contract, conflicts, tombstones, user isolation and the body-size rules. Every call has its
 * own X-Forwarded-For so the per-IP limiters stay out of the way.
 */
const container = createContainer({ logger: new NoopLogger() });
const PULL = '/api/vault/pull';
const PUSH = '/api/vault/push';
const PASSWORD = fakePassword();

let ipCounter = 0;
const nextIp = (): string => `203.0.113.${++ipCounter}`;
let passwordHash: string;

interface Session {
  call: (path: string, body: unknown, ip?: string) => request.Test;
  token: string;
}

async function signIn(email: string, mobile: string): Promise<Session> {
  await db.user.create({
    data: {
      firstName: 'Jane',
      lastName: 'Doe',
      email,
      countryCode: '91',
      mobile,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const device = createDevice();
  const res = await request(container.app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ email, password: PASSWORD, publicKey: device.publicKey });
  const token = res.body.data.token as string;
  return {
    token,
    call: (path, body, ip = nextIp()) =>
      request(container.app)
        .post(path)
        .set('X-Forwarded-For', ip)
        .set(device.signedHeaders(token, 'POST', path))
        .send(body as object),
  };
}

const insertRow = (state: VaultState) => ({
  assumedMasterState: null,
  newDocumentState: toDocument(state),
});

let jane: Session;

beforeAll(async () => {
  passwordHash = await new Argon2PasswordHasher().hash(PASSWORD);
  await container.resources.connectAll();
});
beforeEach(async () => {
  await truncateUsers();
  jane = await signIn('jane@example.com', '9876543210');
});
afterAll(async () => {
  await truncateUsers();
  await container.resources.disconnectAll();
});

describe('authentication', () => {
  it('refuses unsigned, token-only and unauthenticated calls', async () => {
    const body = { checkpoint: null };
    expect(
      (await request(container.app).post(PULL).set('X-Forwarded-For', nextIp()).send(body)).status,
    ).toBe(401);
    const tokenOnly = await request(container.app)
      .post(PULL)
      .set('X-Forwarded-For', nextIp())
      .set('Authorization', `Bearer ${jane.token}`)
      .send(body);
    expect(tokenOnly.status).toBe(401);
    expect(
      (await request(container.app).post(PUSH).set('X-Forwarded-For', nextIp()).send({ rows: [] }))
        .status,
    ).toBe(401);
  });

  it('stops working for a device whose session was replaced by a login elsewhere', async () => {
    expect((await jane.call(PULL, { checkpoint: null })).status).toBe(200);
    await request(container.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'jane@example.com', password: PASSWORD, publicKey: createDevice().publicKey });
    expect((await jane.call(PULL, { checkpoint: null })).status).toBe(401);
  });

  it('answers with no-store and the security headers', async () => {
    const res = await jane.call(PULL, { checkpoint: null });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('pull and push', () => {
  it('starts empty', async () => {
    const res = await jane.call(PULL, { checkpoint: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ documents: [], checkpoint: { seq: 0 } });
  });

  it('stores pushed entries and hands them back in RxDB format, paged by checkpoint', async () => {
    const states = Array.from({ length: 3 }, () => fakeState());
    const pushed = await jane.call(PUSH, { rows: states.map(insertRow) });
    expect(pushed.status).toBe(200);
    expect(pushed.body.data).toEqual({
      conflicts: [],
      counts: { created: 3, updated: 0, deleted: 0 },
    });

    const first = await jane.call(PULL, { checkpoint: null, limit: 2 });
    expect(first.body.data.documents).toEqual(states.slice(0, 2).map(toDocument));
    expect(first.body.data.checkpoint).toEqual({ seq: 2 });
    const second = await jane.call(PULL, { checkpoint: first.body.data.checkpoint, limit: 2 });
    expect(second.body.data.documents).toEqual([toDocument(states[2] as VaultState)]);
    const done = await jane.call(PULL, { checkpoint: second.body.data.checkpoint });
    expect(done.body.data.documents).toEqual([]);
  });

  it('updates with the right assumed state, and answers a stale one with the server version', async () => {
    const v1 = fakeState();
    await jane.call(PUSH, { rows: [insertRow(v1)] });
    const v2 = nextVersion(v1);
    const ok = await jane.call(PUSH, {
      rows: [{ assumedMasterState: toDocument(v1), newDocumentState: toDocument(v2) }],
    });
    expect(ok.body.data).toEqual({ conflicts: [], counts: { created: 0, updated: 1, deleted: 0 } });

    const stale = await jane.call(PUSH, {
      rows: [{ assumedMasterState: toDocument(v1), newDocumentState: toDocument(nextVersion(v1)) }],
    });
    expect(stale.body.data.counts).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(stale.body.data.conflicts).toEqual([toDocument(v2)]);
  });

  it('replicates a delete as a tombstone', async () => {
    const v1 = fakeState();
    await jane.call(PUSH, { rows: [insertRow(v1)] });
    const gone = nextVersion(v1, { deleted: true });
    const res = await jane.call(PUSH, {
      rows: [{ assumedMasterState: toDocument(v1), newDocumentState: toDocument(gone) }],
    });
    expect(res.body.data.counts.deleted).toBe(1);

    const pulled = await jane.call(PULL, { checkpoint: null });
    expect(pulled.body.data.documents).toEqual([toDocument(gone)]);
    expect(pulled.body.data.documents[0]._deleted).toBe(true);
  });

  it("never shows one user's entries to another", async () => {
    await jane.call(PUSH, { rows: [insertRow(fakeState())] });
    const john = await signIn('john@example.com', '9876543211');
    expect((await john.call(PULL, { checkpoint: null })).body.data.documents).toEqual([]);
  });

  it('stores only the opaque blob: the database has no readable columns beyond the envelope', async () => {
    const state = fakeState();
    await jane.call(PUSH, { rows: [insertRow(state)] });
    const row = await db.vaultEntry.findFirstOrThrow();
    expect(row).toMatchObject({
      id: state.id,
      iv: state.envelope.iv,
      ciphertext: state.envelope.ciphertext,
      deleted: false,
    });
    expect(Object.keys(row).sort()).toEqual(
      [
        'algorithm',
        'ciphertext',
        'deleted',
        'envelopeVersion',
        'id',
        'iv',
        'seq',
        'updatedAt',
        'userId',
      ].sort(),
    );
  });
});

describe('validation and limits', () => {
  it('rejects malformed bodies with 400', async () => {
    expect((await jane.call(PULL, {})).status).toBe(400);
    expect((await jane.call(PUSH, { rows: [] })).status).toBe(400);
    const bad = toDocument(fakeState({ id: 'not-a-ulid' }));
    expect(
      (await jane.call(PUSH, { rows: [{ assumedMasterState: null, newDocumentState: bad }] }))
        .status,
    ).toBe(400);
  });

  it('accepts bodies beyond the global 100 KB limit once signed in (large notes)', async () => {
    const big = (): VaultState => {
      const state = fakeState();
      return {
        ...state,
        envelope: { ...state.envelope, ciphertext: randomBytes(60_000).toString('base64') },
      };
    };
    const res = await jane.call(PUSH, {
      rows: [insertRow(big()), insertRow(big()), insertRow(big())],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.counts.created).toBe(3);
  });

  it('still limits every other route to the small global body size', async () => {
    const res = await request(container.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'x@example.com', password: 'x'.repeat(200_000), publicKey: 'x' });
    expect(res.status).toBe(413);
  });

  it('refuses a body over the vault limit', async () => {
    const huge = { rows: [insertRow(fakeState())], padding: 'x'.repeat(1_100_000) };
    expect((await jane.call(PUSH, huge)).status).toBe(413);
  });
});
