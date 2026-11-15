import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_THROTTLE_MAX_ENTRIES,
} from './auth.constants.js';

interface Entry {
  failures: number;
  windowEndsAt: number;
}

/**
 * Per-account brake on password guessing, separate from the per-IP rate limit: a guesser rotating
 * IPs still hits it. In memory on purpose (single instance, no cache by design); a restart resets it.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked(email: string): boolean {
    const entry = this.live(email);
    return entry !== undefined && entry.failures >= LOGIN_MAX_FAILURES;
  }

  recordFailure(email: string): void {
    const entry = this.live(email);
    if (entry) {
      entry.failures += 1;
      return;
    }
    if (this.entries.size >= LOGIN_THROTTLE_MAX_ENTRIES) this.sweep();
    if (this.entries.size >= LOGIN_THROTTLE_MAX_ENTRIES) {
      // Still full of live entries: drop the oldest rather than grow without bound.
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(email, { failures: 1, windowEndsAt: this.now() + LOGIN_FAILURE_WINDOW_MS });
  }

  reset(email: string): void {
    this.entries.delete(email);
  }

  private live(email: string): Entry | undefined {
    const entry = this.entries.get(email);
    if (entry && entry.windowEndsAt <= this.now()) {
      this.entries.delete(email);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    const now = this.now();
    for (const [email, entry] of this.entries) {
      if (entry.windowEndsAt <= now) this.entries.delete(email);
    }
  }
}
