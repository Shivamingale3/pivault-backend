import {
  LOGIN_ATTEMPTS_PER_ROUND,
  LOGIN_IDLE_RESET_MS,
  LOGIN_THROTTLE_MAX_ENTRIES,
  LOGIN_WAITS_MS,
} from './auth.constants.js';

interface Entry {
  /** Wrong passwords in a row since the last success (across rounds). */
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

/** Why an account can't sign in right now. */
export interface LockStatus {
  retryAfterMs: number;
  /** Which wrong password of the round this is (the lock starts on the last one). */
  attempt: number;
  attemptsPerRound: number;
  /** How long the wait after the next round will be. */
  nextWaitMs: number;
}

const waitFor = (round: number): number =>
  LOGIN_WAITS_MS[Math.min(round, LOGIN_WAITS_MS.length) - 1] ?? 0;

/**
 * Per-account brake on password guessing, separate from the per-IP rate limit: a guesser rotating
 * IPs still hits it. Every 5th wrong password starts a longer wait (30 s, 5 min, 1 hour). In memory
 * on purpose (single instance, no cache by design); a restart resets it.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  /** The active lockout, or null when the account may try. */
  lockout(email: string): LockStatus | null {
    const entry = this.live(email);
    return entry && entry.lockedUntil > this.now() ? this.describe(entry) : null;
  }

  /** Counts a wrong password. Returns the lockout when this one started it. */
  recordFailure(email: string): LockStatus | null {
    const now = this.now();
    const entry = this.live(email) ?? this.create(email, now);
    entry.failures += 1;
    entry.lastFailureAt = now;
    if (entry.failures % LOGIN_ATTEMPTS_PER_ROUND !== 0) return null;
    entry.lockedUntil = now + waitFor(entry.failures / LOGIN_ATTEMPTS_PER_ROUND);
    return this.describe(entry);
  }

  reset(email: string): void {
    this.entries.delete(email);
  }

  private describe(entry: Entry): LockStatus {
    const round = Math.ceil(entry.failures / LOGIN_ATTEMPTS_PER_ROUND);
    return {
      retryAfterMs: Math.max(0, entry.lockedUntil - this.now()),
      attempt: ((entry.failures - 1) % LOGIN_ATTEMPTS_PER_ROUND) + 1,
      attemptsPerRound: LOGIN_ATTEMPTS_PER_ROUND,
      nextWaitMs: waitFor(round + 1),
    };
  }

  private live(email: string): Entry | undefined {
    const entry = this.entries.get(email);
    if (!entry) return undefined;
    const idle = this.now() - entry.lastFailureAt > LOGIN_IDLE_RESET_MS;
    if (idle && entry.lockedUntil <= this.now()) {
      this.entries.delete(email);
      return undefined;
    }
    return entry;
  }

  private create(email: string, now: number): Entry {
    if (this.entries.size >= LOGIN_THROTTLE_MAX_ENTRIES) this.sweep();
    if (this.entries.size >= LOGIN_THROTTLE_MAX_ENTRIES) {
      // Still full of live entries: drop the oldest rather than grow without bound.
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    const entry: Entry = { failures: 0, lockedUntil: 0, lastFailureAt: now };
    this.entries.set(email, entry);
    return entry;
  }

  private sweep(): void {
    for (const email of [...this.entries.keys()]) this.live(email);
  }
}
