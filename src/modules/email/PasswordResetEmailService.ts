import { ResetPurpose } from '../passwordReset/passwordReset.constants.js';
import type { IResetTokenIssuer } from '../passwordReset/PasswordResetTokenService.js';
import type { User } from '../user/user.types.js';
import { EmailTemplate, type IEmailSender } from './IEmailSender.js';

/** Sends the forgot-password email with a 15 minute set-password link. Errors propagate. */
export class PasswordResetEmailService {
  constructor(
    private readonly sender: IEmailSender,
    private readonly tokens: IResetTokenIssuer,
    private readonly appUrl: string,
  ) {}

  async send(user: Pick<User, 'id' | 'email' | 'firstName'>): Promise<void> {
    const token = await this.tokens.issue(user.id, ResetPurpose.Reset);
    const resetUrl = new URL('/reset-password', this.appUrl);
    resetUrl.searchParams.set('key', token);
    await this.sender.send({
      to: user.email,
      template: EmailTemplate.PasswordReset,
      variables: { firstName: user.firstName, resetUrl: resetUrl.toString() },
    });
  }
}
