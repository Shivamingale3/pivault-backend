/** Domain shapes for sessions (one per user). */

export const SESSION_KEY_ALGORITHM = 'ECDSA-P256-SHA256';

export interface Session {
  id: string;
  userId: string;
  /** SHA-256 hex of the opaque bearer token. */
  tokenHash: string;
  /** Device public key (SPKI, base64url) that verifies request signatures. */
  publicKey: string;
  keyAlgorithm: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  publicKey: string;
  expiresAt: Date;
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
}

export interface ReplacedSession {
  session: Session;
  /** Token hash of the session this one replaced, if any (to evict it from caches). */
  previousTokenHash: string | null;
}
