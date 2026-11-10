import type { Router } from 'express';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import type { HealthController } from './HealthController.js';

export class HealthRouter extends BaseRouter {
  readonly basePath = '/health';

  constructor(private readonly controller: HealthController) {
    super();
  }

  protected registerRoutes(router: Router): void {
    router.get('/', this.controller.getHealth);
    router.get('/ready', this.controller.getReadiness);
  }
}
