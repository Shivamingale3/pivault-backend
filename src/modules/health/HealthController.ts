import type { Request, Response } from 'express';
import { ApiResponse } from '../../core/http/ApiResponse.js';
import { BaseController } from '../../core/http/BaseController.js';

/** `{ database: true }`. */
export type ReadinessCheck = () => Promise<Record<string, boolean>>;

export class HealthController extends BaseController {
  constructor(private readonly checkReadiness: ReadinessCheck) {
    super();
  }

  /** Liveness: the process is up and serving HTTP. */
  readonly getHealth = (_req: Request, res: Response): void => {
    this.ok(res, 'Server is healthy');
  };

  /** Readiness: every dependency answers. 503 tells the proxy not to route here yet. */
  readonly getReadiness = async (_req: Request, res: Response): Promise<void> => {
    const checks = await this.checkReadiness();
    const ready = Object.values(checks).every(Boolean);
    if (ready) {
      this.ok(res, 'Server is ready', checks);
      return;
    }
    res.status(503).json(ApiResponse.error('Server is not ready', checks));
  };
}
