export const NOT_SIGNED_IN_MESSAGE = 'Not signed in';

/** How far a request's timestamp may differ from server time (clock drift + network delay). */
export const SIGNATURE_MAX_SKEW_MS = 60_000;

/** SHA-256 of the request body, base64url (43 characters). Part of what the device signs. */
export const BODY_HASH_HEADER = 'x-body-sha256';
export const BODY_HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Older app versions sign without the body. Accepted only until every installed app has updated;
 * then set this to false. A request signed WITH its body can't be downgraded: its signature only
 * verifies with the body hash in it.
 */
export const ACCEPT_LEGACY_SIGNATURES = true;

/**
 * What the device signs for each authenticated request, with its non-extractable private key
 * (ECDSA P-256 / SHA-256, raw r||s signature, base64url). `path` has no query string; `bodyHash`
 * is the SHA-256 of the exact body bytes (base64url), also sent as `X-Body-SHA256`.
 * Sent as: `Authorization: Bearer <session token>`, `X-Timestamp: <ms epoch>`, `X-Signature`.
 * A stolen token alone is useless without the device key, and a captured request can't be re-sent
 * with a different body.
 */
export const signaturePayload = (
  timestamp: string,
  method: string,
  path: string,
  bodyHash?: string,
): string => {
  const base = `${timestamp}.${method.toUpperCase()}.${path}`;
  return bodyHash === undefined ? base : `${base}.${bodyHash}`;
};
