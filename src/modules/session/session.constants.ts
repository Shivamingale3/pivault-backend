export const NOT_SIGNED_IN_MESSAGE = 'Not signed in';

/** How far a request's timestamp may differ from server time (clock drift + network delay). */
export const SIGNATURE_MAX_SKEW_MS = 60_000;

/**
 * What the device signs for each authenticated request, with its non-extractable private key
 * (ECDSA P-256 / SHA-256, raw r||s signature, base64url). `path` has no query string.
 * Sent as: `Authorization: Bearer <session token>`, `X-Timestamp: <ms epoch>`, `X-Signature`.
 * A stolen token alone is useless without the device key. Request bodies are not covered yet.
 */
export const signaturePayload = (timestamp: string, method: string, path: string): string =>
  `${timestamp}.${method.toUpperCase()}.${path}`;
