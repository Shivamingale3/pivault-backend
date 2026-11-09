import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';

export class HealthController extends BaseController {
  /** Liveness: the process is up and serving HTTP. */
  readonly getHealth = (_req: Request, res: Response): void => {
    this.ok(res, 'Server is healthy');
  };
}
