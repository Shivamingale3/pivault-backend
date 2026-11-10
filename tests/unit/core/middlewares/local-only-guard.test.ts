import type { Request, Response } from 'express';
import { describe, it, expect, vi } from 'vitest';
import { NotFoundError } from '../../../../src/core/errors/HttpErrors.js';
import { LocalOnlyGuard } from '../../../../src/core/middlewares/LocalOnlyGuard.js';
import { createFakeLogger } from '../../../helpers/fakes.js';

function run(remoteAddress: string | undefined, headers: Record<string, string> = {}) {
  const logger = createFakeLogger();
  const next = vi.fn();
  const req = {
    socket: { remoteAddress },
    headers,
    method: 'POST',
    originalUrl: '/api/internal/register',
  } as unknown as Request;
  new LocalOnlyGuard(logger).handle(req, {} as Response, next);
  return { next, logger };
}

describe('LocalOnlyGuard', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('allows loopback peer %s', (address) => {
    const { next } = run(address);
    expect(next).toHaveBeenCalledWith();
  });

  it.each(['192.168.1.20', '100.83.1.25', '172.18.0.2', undefined])(
    'answers 404 for non-loopback peer %s',
    (address) => {
      const { next, logger } = run(address);
      expect(next.mock.calls[0]?.[0]).toBeInstanceOf(NotFoundError);
      expect(logger.warn).toHaveBeenCalledOnce();
    },
  );

  it.each(['x-forwarded-for', 'forwarded', 'x-real-ip'])(
    'answers 404 when a proxy header (%s) is present, even from loopback',
    (header) => {
      const { next } = run('127.0.0.1', { [header]: '203.0.113.9' });
      expect(next.mock.calls[0]?.[0]).toBeInstanceOf(NotFoundError);
    },
  );
});
