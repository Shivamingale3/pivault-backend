import { ResetPurpose } from '../passwordReset/passwordReset.constants.js';
import type { IResetTokenIssuer } from '../passwordReset/PasswordResetTokenService.js';
import type { User } from '../user/user.types.js';
import { EmailTemplate, type IEmailSender } from './IEmailSender.js';

/**
 * Sends the welcome email, which doubles as onboarding: it carries a set-password link,
 * so a new user must choose their own password. Sends in-process; errors propagate.
 */
export class WelcomeEmailService {
  constructor(
    private readonly sender: IEmailSender,
    private readonly tokens: IResetTokenIssuer,
    private readonly appUrl: string,
  ) {}

  async send(user: Pick<User, 'id' | 'email' | 'firstName'>): Promise<void> {
    const token = await this.tokens.issue(user.id, ResetPurpose.Onboarding);
    const resetUrl = new URL('/reset-password', this.appUrl);
    resetUrl.searchParams.set('key', token);
    await this.sender.send({
      to: user.email,
      template: EmailTemplate.Welcome,
      variables: { firstName: user.firstName, resetUrl: resetUrl.toString() },
    });
  }
}
