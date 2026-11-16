import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/** SHA-256 of the bytes, base64url: the form the device signs and sends in `X-Body-SHA256`. */
export const sha256Base64Url = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('base64url');

/** What a request with no body hashes to. */
export const EMPTY_BODY_HASH = sha256Base64Url('');

const hashes = new WeakMap<IncomingMessage, string>();

/**
 * The `verify` hook for every `express.json()` in the app: remembers the hash of the exact bytes
 * received, before parsing, so `SessionAuthGuard.verifyBody` can compare it with what was signed.
 */
export const recordBodyHash = (req: IncomingMessage, _res: unknown, raw: Buffer): void => {
  hashes.set(req, sha256Base64Url(raw));
};

/** The hash of the body that was actually received (a request without a parsed body counts as empty). */
export const receivedBodyHash = (req: IncomingMessage): string =>
  hashes.get(req) ?? EMPTY_BODY_HASH;
