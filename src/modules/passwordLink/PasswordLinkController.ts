import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';
import type { CompleteLinkInput, ValidateLinkInput } from './passwordLink.schema.js';
import type { PasswordLinkService } from './PasswordLinkService.js';

export class PasswordLinkController extends BaseController {
  constructor(private readonly service: PasswordLinkService) {
    super();
  }

  /** Body was already validated by the router's validator. */
  readonly validate = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as ValidateLinkInput;
    this.ok(res, 'Link is valid', await this.service.validate(token));
  };

  readonly complete = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body as CompleteLinkInput;
    await this.service.complete(token, password);
    this.ok(res, 'Password set and email verified', { emailVerified: true });
  };
}
