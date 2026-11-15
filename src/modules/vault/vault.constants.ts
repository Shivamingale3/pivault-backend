/** The only envelope the app writes: AES-256-GCM, 12 byte IV (16 base64 characters). */
export const ENVELOPE_VERSION = 1;
export const ENVELOPE_ALGORITHM = 'AES-GCM-256';
export const IV_BASE64_LENGTH = 16;
/** A GCM tag alone is 16 bytes = 24 base64 characters. */
export const CIPHERTEXT_MIN_LENGTH = 24;
/** ~64 KB of plaintext. The app refuses to encrypt more than this per entry. */
export const CIPHERTEXT_MAX_LENGTH = 90_000;

export const ENTRY_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
export const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

export const PULL_DEFAULT_LIMIT = 50;
export const PULL_MAX_LIMIT = 100;
export const PUSH_MAX_ROWS = 10;

/** Up to 10 entries of ~90 KB of base64 each. Applied only after the session is verified. */
export const VAULT_BODY_LIMIT = '1mb';
