import { describe, it, expect, vi } from 'vitest';
import type { Router } from 'express';
import { BaseRouter } from '../../../src/core/http/BaseRouter.js';

class SpyRouter extends BaseRouter {
  readonly basePath = '/spy';
  readonly register = vi.fn((router: Router) => {
    router.get('/', (_req, res) => {
      res.end();
    });
  });

  protected registerRoutes(router: Router): void {
    this.register(router);
  }
}

describe('BaseRouter', () => {
  it('registers routes lazily, exactly once, and returns the same router', () => {
    const spy = new SpyRouter();
    expect(spy.register).not.toHaveBeenCalled();

    const first = spy.getRouter();
    const second = spy.getRouter();

    expect(first).toBe(second);
    expect(spy.register).toHaveBeenCalledOnce();
    expect(spy.basePath).toBe('/spy');
  });
});
