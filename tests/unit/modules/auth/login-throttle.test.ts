import { describe, it, expect } from 'vitest';
import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_THROTTLE_MAX_ENTRIES,
} from '../../../../src/modules/auth/auth.constants.js';
import { LoginThrottle } from '../../../../src/modules/auth/LoginThrottle.js';

describe('LoginThrottle', () => {
  it('blocks an account after too many failures, only that account', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) throttle.recordFailure('a@x.co');
    expect(throttle.isBlocked('a@x.co')).toBe(false);
    throttle.recordFailure('a@x.co');
    expect(throttle.isBlocked('a@x.co')).toBe(true);
    expect(throttle.isBlocked('b@x.co')).toBe(false);
  });

  it('unblocks when the window passes and on reset', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('a@x.co');
    now = LOGIN_FAILURE_WINDOW_MS;
    expect(throttle.isBlocked('a@x.co')).toBe(false);

    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('a@x.co');
    throttle.reset('a@x.co');
    expect(throttle.isBlocked('a@x.co')).toBe(false);
  });

  it('stays bounded when flooded with distinct emails', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let i = 0; i < LOGIN_THROTTLE_MAX_ENTRIES + 50; i += 1)
      throttle.recordFailure(`u${i}@x.co`);
    expect(
      (throttle as unknown as { entries: Map<string, unknown> }).entries.size,
    ).toBeLessThanOrEqual(LOGIN_THROTTLE_MAX_ENTRIES);
  });
});
