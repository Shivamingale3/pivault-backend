import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';
import type { RegisterInput } from './register.schema.js';
import type { RegisterService } from './RegisterService.js';

export class RegisterController extends BaseController {
  constructor(private readonly service: RegisterService) {
    super();
  }

  /** Body was already validated and normalised by the router's validator. */
  readonly register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.register(req.body as RegisterInput);
    this.created(res, 'User registered', result);
  };
}
