import { verify } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { sha256Hex } from '../../core/crypto/hash.js';
import { UnauthorizedError } from '../../core/errors/HttpErrors.js';
import { parseDevicePublicKey } from '../auth/devicePublicKey.js';
import {
  ACCEPT_LEGACY_SIGNATURES,
  BODY_HASH_HEADER,
  BODY_HASH_PATTERN,
  NOT_SIGNED_IN_MESSAGE,
  SIGNATURE_MAX_SKEW_MS,
  signaturePayload,
} from './session.constants.js';
import { receivedBodyHash } from '../../core/crypto/bodyHash.js';
import type { SessionStore } from './SessionStore.js';

/** Set on `res.locals.auth` for handlers behind the guard. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  /** The body hash the device signed, or null for an older app that signs without the body. */
  signedBodyHash: string | null;
}

/** The signed-in user and session, for handlers behind the guard. */
export const authOf = (res: Response): AuthContext => res.locals['auth'] as AuthContext;

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,128})$/;

/**
 * Requires a live session token AND a fresh signature from that session's device key, covering
 * the method, path and body. Every failure answers the same 401, so callers learn nothing about
 * which check failed. `handle` checks the signature; `verifyBody` (after the body is parsed)
 * checks that the body received is the one that was signed. Use both: see `container.ts`.
 */
export class SessionAuthGuard {
  constructor(
    private readonly sessions: SessionStore,
    private readonly now: () => number = Date.now,
    private readonly acceptLegacy: boolean = ACCEPT_LEGACY_SIGNATURES,
  ) {}

  readonly handle: RequestHandler = async (req, res, next) => {
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
    const timestamp = req.get('x-timestamp');
    const signature = req.get('x-signature');
    const claimed = req.get(BODY_HASH_HEADER);
    const bodyHash = claimed !== undefined && BODY_HASH_PATTERN.test(claimed) ? claimed : null;
    const malformed = claimed !== undefined && bodyHash === null;
    const legacyRefused = bodyHash === null && !this.acceptLegacy;
    if (
      !token ||
      !timestamp ||
      !signature ||
      !this.isFresh(timestamp) ||
      malformed ||
      legacyRefused
    ) {
      throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    }

    const session = await this.sessions.findActive(sha256Hex(token));
    const key = session ? parseDevicePublicKey(session.publicKey) : null;
    const path = req.originalUrl.split('?')[0] ?? '';
    const signed = key
      ? this.verifySignature(
          key,
          signaturePayload(timestamp, req.method, path, bodyHash ?? undefined),
          signature,
        )
      : false;
    if (!session || !signed) throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);

    const context: AuthContext = {
      userId: session.userId,
      sessionId: session.id,
      signedBodyHash: bodyHash,
    };
    res.locals['auth'] = context;
    next();
  };

  /**
   * The body that arrived must be the body that was signed. Runs after the JSON parser (which
   * records the hash of the raw bytes) and after `handle`. Same 401 as every other failure.
   */
  readonly verifyBody: RequestHandler = (req, res, next) => {
    const { signedBodyHash } = authOf(res);
    if (signedBodyHash !== null && signedBodyHash !== receivedBodyHash(req)) {
      throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    }
    next();
  };

  /** Both checks, for routes whose body is parsed by the app before the router runs. */
  get requireSession(): RequestHandler[] {
    return [this.handle, this.verifyBody];
  }

  private isFresh(timestamp: string): boolean {
    const sent = Number(timestamp);
    return Number.isFinite(sent) && Math.abs(this.now() - sent) <= SIGNATURE_MAX_SKEW_MS;
  }

  private verifySignature(
    key: NonNullable<ReturnType<typeof parseDevicePublicKey>>,
    payload: string,
    signature: string,
  ): boolean {
    try {
      return verify(
        'sha256',
        Buffer.from(payload, 'utf8'),
        { key, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url'),
      );
    } catch {
      return false;
    }
  }
}
