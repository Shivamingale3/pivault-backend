import { verify } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { sha256Hex } from '../../core/crypto/hash.js';
import { UnauthorizedError } from '../../core/errors/HttpErrors.js';
import { parseDevicePublicKey } from '../auth/devicePublicKey.js';
import {
  NOT_SIGNED_IN_MESSAGE,
  SIGNATURE_MAX_SKEW_MS,
  signaturePayload,
} from './session.constants.js';
import type { SessionStore } from './SessionStore.js';

/** Set on `res.locals.auth` for handlers behind the guard. */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

/** The signed-in user and session, for handlers behind the guard. */
export const authOf = (res: Response): AuthContext => res.locals['auth'] as AuthContext;

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,128})$/;

/**
 * Requires a live session token AND a fresh signature from that session's device key. Every
 * failure answers the same 401, so callers learn nothing about which check failed.
 */
export class SessionAuthGuard {
  constructor(
    private readonly sessions: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  readonly handle: RequestHandler = async (req, res, next) => {
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
    const timestamp = req.get('x-timestamp');
    const signature = req.get('x-signature');
    if (!token || !timestamp || !signature || !this.isFresh(timestamp)) {
      throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    }

    const session = await this.sessions.findActive(sha256Hex(token));
    const key = session ? parseDevicePublicKey(session.publicKey) : null;
    const path = req.originalUrl.split('?')[0] ?? '';
    const signed = key
      ? this.verifySignature(key, signaturePayload(timestamp, req.method, path), signature)
      : false;
    if (!session || !signed) throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);

    const context: AuthContext = { userId: session.userId, sessionId: session.id };
    res.locals['auth'] = context;
    next();
  };

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
