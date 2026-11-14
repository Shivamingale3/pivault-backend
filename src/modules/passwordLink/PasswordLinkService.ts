import type { IPasswordHasher } from '../../core/crypto/IPasswordHasher.js';
import { sha256Hex } from '../../core/crypto/hash.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import type { IPasswordResetRepository } from '../passwordReset/IPasswordResetRepository.js';
import type { PasswordResetToken } from '../passwordReset/passwordReset.types.js';
import { InvalidLinkError } from './passwordLink.errors.js';
import type { LinkStatus } from './passwordLink.types.js';

/**
 * Turns an emailed link into a password: checks the token, then sets the password and
 * verifies the email in one atomic step. Serves both the welcome link and forgot-password.
 * Never logs or returns the token or the password.
 */
export class PasswordLinkService {
  constructor(
    private readonly tokens: IPasswordResetRepository,
    private readonly hasher: IPasswordHasher,
    private readonly logger: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Read-only check so the page can show the form or the "bad link" state. */
  async validate(rawToken: string): Promise<LinkStatus> {
    const token = await this.findLive(rawToken);
    return { purpose: token.purpose, expiresAt: token.expiresAt };
  }

  async complete(rawToken: string, password: string): Promise<void> {
    // Cheap checks first: a bad token must never cost an argon2 hash (CPU-exhaustion guard).
    await this.findLive(rawToken);
    const passwordHash = await this.hasher.hash(password);
    const consumed = await this.tokens.consumeToSetPassword({
      tokenHash: sha256Hex(rawToken),
      passwordHash,
      now: this.now(),
    });
    if (!consumed) throw new InvalidLinkError();
    this.logger.info(`Password set and email verified for user ${consumed.userId}.`);
  }

  private async findLive(rawToken: string): Promise<PasswordResetToken> {
    const token = await this.tokens.findByHash(sha256Hex(rawToken));
    if (!token || token.expiresAt <= this.now()) throw new InvalidLinkError();
    return token;
  }
}
