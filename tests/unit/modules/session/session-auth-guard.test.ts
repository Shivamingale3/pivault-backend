import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../../../src/core/crypto/hash.js';
import { SIGNATURE_MAX_SKEW_MS } from '../../../../src/modules/session/session.constants.js';
import { authOf, SessionAuthGuard } from '../../../../src/modules/session/SessionAuthGuard.js';
import { SessionStore } from '../../../../src/modules/session/SessionStore.js';
import { createDevice } from '../../../helpers/deviceKey.js';
import { InMemorySessionRepository } from '../../../helpers/InMemorySessionRepository.js';

const TOKEN = 'a'.repeat(43);
const NOW = 1_800_000_000_000;
const PATH = '/api/auth/logout';

let device: ReturnType<typeof createDevice>;
let repo: InMemorySessionRepository;
let guard: SessionAuthGuard;

beforeEach(async () => {
  device = createDevice();
  repo = new InMemorySessionRepository();
  await repo.replaceForUser({
    userId: 'user-1',
    tokenHash: sha256Hex(TOKEN),
    publicKey: device.publicKey,
    expiresAt: new Date(NOW + 86_400_000),
  });
  guard = new SessionAuthGuard(new SessionStore(repo, () => new Date(NOW)), () => NOW);
});

/** Runs the guard with the given headers and resolves with what it did. */
async function run(headers: Record<string, string>, method = 'POST', url = PATH) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const req = {
    get: (name: string) => lower[name.toLowerCase()],
    method,
    originalUrl: url,
  } as unknown as Request;
  const res = { locals: {} } as unknown as Response;
  const next = vi.fn();
  // Express types handlers as returning void, but this one is async and rejects on failure.
  const pending = guard.handle(req, res, next) as unknown as Promise<void>;
  const outcome = await pending.then(
    () => 'ok' as const,
    (error: unknown) => error,
  );
  return { outcome, res, next };
}

const UNAUTHORIZED = { statusCode: 401, message: 'Not signed in' };

/** The outcome of a request that should be refused, with `next` checked not to have run. */
async function denied(headers: Record<string, string>, method = 'POST', url = PATH) {
  const { outcome, next } = await run(headers, method, url);
  expect(next).not.toHaveBeenCalled();
  return outcome;
}

describe('SessionAuthGuard', () => {
  it('lets a correctly signed request through and exposes the user', async () => {
    const { outcome, res, next } = await run(device.signedHeaders(TOKEN, 'POST', PATH, NOW));
    expect(outcome).toBe('ok');
    expect(next).toHaveBeenCalledOnce();
    expect(authOf(res)).toMatchObject({ userId: 'user-1' });
  });

  it('ignores the query string when checking the signed path', async () => {
    const { outcome } = await run(
      device.signedHeaders(TOKEN, 'POST', PATH, NOW),
      'POST',
      `${PATH}?a=1`,
    );
    expect(outcome).toBe('ok');
  });

  it('rejects missing or malformed headers', async () => {
    const good = device.signedHeaders(TOKEN, 'POST', PATH, NOW);
    expect(await denied({})).toMatchObject(UNAUTHORIZED);
    expect(await denied({ ...good, Authorization: 'Basic abc' })).toMatchObject(UNAUTHORIZED);
    expect(
      await denied({ 'X-Timestamp': good['X-Timestamp'], 'X-Signature': good['X-Signature'] }),
    ).toMatchObject(UNAUTHORIZED);
    expect(
      await denied({ Authorization: good.Authorization, 'X-Signature': good['X-Signature'] }),
    ).toMatchObject(UNAUTHORIZED);
    expect(await denied({ ...good, 'X-Timestamp': 'soon' })).toMatchObject(UNAUTHORIZED);
  });

  it('rejects a token with no session', async () => {
    expect(await denied(device.signedHeaders('b'.repeat(43), 'POST', PATH, NOW))).toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects a signature from another device', async () => {
    expect(await denied(createDevice().signedHeaders(TOKEN, 'POST', PATH, NOW))).toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects a signature made for a different method or path', async () => {
    expect(await denied(device.signedHeaders(TOKEN, 'GET', PATH, NOW))).toMatchObject(UNAUTHORIZED);
    expect(await denied(device.signedHeaders(TOKEN, 'POST', '/api/auth/other', NOW))).toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects stale and far-future timestamps, accepts the edge of the window', async () => {
    expect(
      await denied(device.signedHeaders(TOKEN, 'POST', PATH, NOW - SIGNATURE_MAX_SKEW_MS - 1)),
    ).toMatchObject(UNAUTHORIZED);
    expect(
      await denied(device.signedHeaders(TOKEN, 'POST', PATH, NOW + SIGNATURE_MAX_SKEW_MS + 1)),
    ).toMatchObject(UNAUTHORIZED);
    const edge = await run(device.signedHeaders(TOKEN, 'POST', PATH, NOW - SIGNATURE_MAX_SKEW_MS));
    expect(edge.outcome).toBe('ok');
  });

  it('rejects an expired session', async () => {
    await repo.replaceForUser({
      userId: 'user-1',
      tokenHash: sha256Hex(TOKEN),
      publicKey: device.publicKey,
      expiresAt: new Date(NOW - 1),
    });
    expect(await denied(device.signedHeaders(TOKEN, 'POST', PATH, NOW))).toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects a garbage signature without throwing', async () => {
    const good = device.signedHeaders(TOKEN, 'POST', PATH, NOW);
    expect(await denied({ ...good, 'X-Signature': '!!!' })).toMatchObject(UNAUTHORIZED);
    expect(await denied({ ...good, 'X-Signature': 'AAAA' })).toMatchObject(UNAUTHORIZED);
  });
});
