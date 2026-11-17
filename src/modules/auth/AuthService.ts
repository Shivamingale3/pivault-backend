import { randomBytes } from 'node:crypto';
import type { IPasswordHasher } from '../../core/crypto/IPasswordHasher.js';
import { sha256Hex } from '../../core/crypto/hash.js';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/HttpErrors.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import { NOT_SIGNED_IN_MESSAGE } from '../session/session.constants.js';
import type { SessionStore } from '../session/SessionStore.js';
import type { IUserRepository } from '../user/IUserRepository.js';
import {
  EMAIL_NOT_VERIFIED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  SESSION_TOKEN_BYTES,
  SESSION_TTL_DAYS,
} from './auth.constants.js';
import { LoginLockedError } from './loginLocked.error.js';
import type { LoginRequest, LoginResult } from './auth.types.js';
import type { LoginThrottle } from './LoginThrottle.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Account login and logout. Login checks the password, then creates the user's only session
 * (replacing any older one) bound to the device public key. Never logs passwords or tokens.
 */
export class AuthService {
  private dummyHash: Promise<string> | null = null;
  /** The last queued login per account (see `login`). Entries remove themselves when done. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: SessionStore,
    private readonly throttle: LoginThrottle,
    private readonly logger: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Logins for one account run one at a time. Without this, a burst of parallel guesses would all
   * pass the lockout check before any of them was counted, and get far more than five tries a round.
   */
  login(request: LoginRequest): Promise<LoginResult> {
    const { email } = request;
    const previous = this.inFlight.get(email) ?? Promise.resolve();
    const run = previous.then(() => this.attemptLogin(request));
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.inFlight.set(email, tail);
    void tail.then(() => {
      if (this.inFlight.get(email) === tail) this.inFlight.delete(email);
    });
    return run;
  }

  private async attemptLogin(request: LoginRequest): Promise<LoginResult> {
    const { email, password } = request;
    const locked = this.throttle.lockout(email);
    if (locked) throw new LoginLockedError(locked);

    const user = await this.users.findAuthByEmail(email);
    // An unknown email still pays for one argon2 verify, so response time doesn't reveal accounts.
    const passwordOk = await this.hasher.verify(
      user?.passwordHash ?? (await this.getDummyHash()),
      password,
    );
    if (!user || !passwordOk) {
      // The wrong password that starts a lockout is answered with the lockout itself.
      const started = this.throttle.recordFailure(email);
      if (started) throw new LoginLockedError(started);
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }
    if (!user.emailVerifiedAt) throw new ForbiddenError(EMAIL_NOT_VERIFIED_MESSAGE);

    this.throttle.reset(email);
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_DAYS * DAY_MS);
    await this.sessions.replace({
      userId: user.id,
      tokenHash: sha256Hex(token),
      publicKey: request.publicKey,
      expiresAt,
      userAgent: request.userAgent,
      ipAddress: request.ipAddress,
    });
    this.logger.info(`User ${user.id} signed in.`);

    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      recoveryKeyConfigured: user.recoveryKeyConfiguredAt !== null,
    };
  }

  /** The device generated its recovery key. Idempotent; the key itself never reaches the server. */
  async markRecoveryKeyConfigured(userId: string): Promise<void> {
    const found = await this.users.markRecoveryKeyConfigured(userId, this.now());
    if (!found) throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    this.logger.info(`User ${userId} configured a recovery key.`);
  }

  async logout(userId: string): Promise<void> {
    await this.sessions.revokeForUser(userId);
    this.logger.info(`User ${userId} signed out.`);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
