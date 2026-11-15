export interface LoginRequest {
  email: string;
  password: string;
  /** Device public key, SPKI base64url. */
  publicKey: string;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface LoginResult {
  /** Raw opaque session token. Only ever returned here; the server keeps its hash. */
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; firstName: string; lastName: string };
  /** False on a user's first login: the app must create and show the recovery key. */
  recoveryKeyConfigured: boolean;
}
