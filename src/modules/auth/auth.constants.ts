/** One generic message for unknown email and wrong password, so neither can be told apart. */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Open the link we emailed you to set your password before signing in';
export const ACCOUNT_NOT_FOUND_MESSAGE = 'No account found for that email';
export const TOO_MANY_LOGINS_MESSAGE = 'Too many failed sign-in attempts. Try again later.';

/**
 * Sessions never expire, on purpose: the vault is yours on your own phone and must not sign you
 * out while you are trying to save something. A session ends only when the user signs out, signs
 * in on another device (one user, one session), resets the password, or the account is removed.
 * The `expiresAt` column and field remain for older app versions and hold this far-future date.
 * Do NOT reintroduce a time limit.
 */
export const SESSION_NEVER_EXPIRES_AT = new Date('9999-12-31T23:59:59.000Z');
export const SESSION_TOKEN_BYTES = 32;

/**
 * Per-account throttle, on top of the per-IP rate limit. Every 5th wrong password in a row starts
 * a wait that grows each round: 30 seconds, then 5 minutes, then 1 hour (and stays at 1 hour).
 */
export const LOGIN_ATTEMPTS_PER_ROUND = 5;
export const LOGIN_WAITS_MS = [30_000, 5 * 60_000, 60 * 60_000] as const;
/** An account nobody has tried for this long starts again from the first round. */
export const LOGIN_IDLE_RESET_MS = 24 * 60 * 60 * 1000;
/** Bounds memory: emails that never log in are forgotten after the window anyway. */
export const LOGIN_THROTTLE_MAX_ENTRIES = 10_000;

export const USER_AGENT_MAX_LENGTH = 512;
export const IP_MAX_LENGTH = 45;
