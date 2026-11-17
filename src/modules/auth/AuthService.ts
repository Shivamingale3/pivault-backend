import { randomBytes } from 'node:crypto';
import type { IPasswordHasher } from '../../core/crypto/IPasswordHasher.js';
import { sha256Hex } from '../../core/crypto/hash.js';
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '../../core/errors/HttpErrors.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import { NOT_SIGNED_IN_MESSAGE } from '../session/session.constants.js';
import type { SessionStore } from '../session/SessionStore.js';
import type { IUserRepository } from '../user/IUserRepository.js';
import type { RecoveryKeyCheck } from '../user/user.types.js';
import {
  EMAIL_NOT_VERIFIED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  WRONG_CURRENT_PASSWORD_MESSAGE,
  SESSION_TOKEN_BYTES,
  SESSION_NEVER_EXPIRES_AT,
} from './auth.constants.js';
import { LoginLockedError } from './loginLocked.error.js';
import type { LoginRequest, LoginResult } from './auth.types.js';
import type { LoginThrottle } from './LoginThrottle.js';

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
    return this.oneAtATime(request.email, () => this.attemptLogin(request));
  }

  /**
   * A signed-in user sets a new password after proving the current one. Wrong guesses count
   * toward the same per-account lockout as login (someone holding an unlocked phone must not get
   * unlimited tries). The session stays: there is only one, and it is this device's.
   */
  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.users.findAuthById(userId);
    if (!user) throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    await this.oneAtATime(user.email, async () => {
      const locked = this.throttle.lockout(user.email);
      if (locked) throw new LoginLockedError(locked);
      if (!(await this.hasher.verify(user.passwordHash, current))) {
        const started = this.throttle.recordFailure(user.email);
        if (started) throw new LoginLockedError(started);
        throw new BadRequestError(WRONG_CURRENT_PASSWORD_MESSAGE);
      }
      await this.users.updatePassword(userId, await this.hasher.hash(next), this.now());
      this.throttle.reset(user.email);
    });
    this.logger.info(`User ${userId} changed their password.`);
  }

  /** Runs password checks for one account in order (see `login`). */
  private oneAtATime<T>(email: string, task: () => Promise<T>): Promise<T> {
    const previous = this.inFlight.get(email) ?? Promise.resolve();
    const run = previous.then(task);
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
    const expiresAt = SESSION_NEVER_EXPIRES_AT;
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

  /**
   * The device generated its recovery key. Idempotent; the key itself never reaches the server.
   * `keyCheck` (a fixed text encrypted with the vault key) is kept the first time one arrives, so
   * a new device can later prove a typed key is right.
   */
  async markRecoveryKeyConfigured(userId: string, keyCheck?: RecoveryKeyCheck): Promise<void> {
    const found = await this.users.markRecoveryKeyConfigured(userId, this.now());
    if (!found) throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
    if (keyCheck) await this.users.saveRecoveryKeyCheck(userId, keyCheck);
    this.logger.info(`User ${userId} configured a recovery key.`);
  }

  /** The stored recovery-key check, or null when this account has none yet. */
  recoveryKeyCheck(userId: string): Promise<RecoveryKeyCheck | null> {
    return this.users.findRecoveryKeyCheck(userId);
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
