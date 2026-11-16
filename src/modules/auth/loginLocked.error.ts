import { AppError } from '../../core/errors/AppError.js';
import { TOO_MANY_LOGINS_MESSAGE } from './auth.constants.js';
import type { LockStatus } from './LoginThrottle.js';

/** What the sign-in screen needs for its live countdown ("Attempt 5 of 5 · next wait 5 min"). */
export interface LoginLockData {
  retryAfterSeconds: number;
  attempt: number;
  attemptsPerRound: number;
  nextWaitSeconds: number;
}

/** HTTP 429 with the wait in `data`, so the app can count down instead of guessing. */
export class LoginLockedError extends AppError {
  constructor(status: LockStatus) {
    super(429, TOO_MANY_LOGINS_MESSAGE);
    this.data = {
      retryAfterSeconds: Math.ceil(status.retryAfterMs / 1000),
      attempt: status.attempt,
      attemptsPerRound: status.attemptsPerRound,
      nextWaitSeconds: Math.ceil(status.nextWaitMs / 1000),
    } satisfies LoginLockData;
  }
}
