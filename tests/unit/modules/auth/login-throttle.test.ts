import { describe, expect, it } from 'vitest';
import {
  LOGIN_ATTEMPTS_PER_ROUND,
  LOGIN_IDLE_RESET_MS,
  LOGIN_THROTTLE_MAX_ENTRIES,
} from '../../../../src/modules/auth/auth.constants.js';
import { LoginThrottle } from '../../../../src/modules/auth/LoginThrottle.js';

const EMAIL = 'a@x.co';
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Wrong passwords until the next lockout starts; returns it. */
const failRound = (throttle: LoginThrottle, email = EMAIL) => {
  let started = null;
  for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND; i += 1) started = throttle.recordFailure(email);
  return started;
};

describe('LoginThrottle', () => {
  it('lets an account fail four times, and locks it on the fifth', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 1; i += 1) {
      expect(throttle.recordFailure(EMAIL)).toBeNull();
    }
    expect(throttle.lockout(EMAIL)).toBeNull();
    expect(throttle.recordFailure(EMAIL)).toEqual({
      retryAfterMs: 30 * SECOND,
      attempt: 5,
      attemptsPerRound: 5,
      nextWaitMs: 5 * MINUTE,
    });
    expect(throttle.lockout(EMAIL)?.retryAfterMs).toBe(30 * SECOND);
  });

  it('only locks the account that failed', () => {
    const throttle = new LoginThrottle(() => 0);
    failRound(throttle);
    expect(throttle.lockout('b@x.co')).toBeNull();
  });

  it('counts the wait down, then lets the account try again', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    failRound(throttle);
    now = 10 * SECOND;
    expect(throttle.lockout(EMAIL)?.retryAfterMs).toBe(20 * SECOND);
    now = 30 * SECOND;
    expect(throttle.lockout(EMAIL)).toBeNull();
  });

  it('makes each round wait longer: 30 s, 5 min, 1 hour, then 1 hour again', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    const waits: number[] = [];
    const nexts: number[] = [];
    for (let round = 0; round < 4; round += 1) {
      const started = failRound(throttle);
      waits.push(started?.retryAfterMs ?? 0);
      nexts.push(started?.nextWaitMs ?? 0);
      now += (started?.retryAfterMs ?? 0) + 1;
    }
    expect(waits).toEqual([30 * SECOND, 5 * MINUTE, 60 * MINUTE, 60 * MINUTE]);
    expect(nexts).toEqual([5 * MINUTE, 60 * MINUTE, 60 * MINUTE, 60 * MINUTE]);
  });

  it('numbers the attempts again in each round', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    failRound(throttle);
    now = 31 * SECOND;
    expect(throttle.recordFailure(EMAIL)).toBeNull();
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 2; i += 1) throttle.recordFailure(EMAIL);
    expect(throttle.recordFailure(EMAIL)).toMatchObject({ attempt: 5, retryAfterMs: 5 * MINUTE });
  });

  it('forgets everything after a success', () => {
    const throttle = new LoginThrottle(() => 0);
    failRound(throttle);
    throttle.reset(EMAIL);
    expect(throttle.lockout(EMAIL)).toBeNull();
    expect(failRound(throttle)?.retryAfterMs).toBe(30 * SECOND);
  });

  it('starts again from the first round after a day of quiet', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    failRound(throttle);
    now = 31 * SECOND;
    failRound(throttle);
    now += LOGIN_IDLE_RESET_MS + 10 * MINUTE;
    expect(throttle.lockout(EMAIL)).toBeNull();
    expect(failRound(throttle)?.retryAfterMs).toBe(30 * SECOND);
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
