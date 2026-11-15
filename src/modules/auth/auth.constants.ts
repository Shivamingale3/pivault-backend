/** One generic message for unknown email and wrong password, so neither can be told apart. */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Open the link we emailed you to set your password before signing in';
export const ACCOUNT_NOT_FOUND_MESSAGE = 'No account found for that email';
export const TOO_MANY_LOGINS_MESSAGE = 'Too many failed sign-in attempts. Try again later.';

export const SESSION_TTL_DAYS = 30;
export const SESSION_TOKEN_BYTES = 32;

/** Per-account throttle, on top of the per-IP rate limit. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Bounds memory: emails that never log in are forgotten after the window anyway. */
export const LOGIN_THROTTLE_MAX_ENTRIES = 10_000;

export const USER_AGENT_MAX_LENGTH = 512;
export const IP_MAX_LENGTH = 45;
