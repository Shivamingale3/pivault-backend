import { Router } from 'express';
import type { IRouteModule } from './IRouteModule.js';

/**
 * Template Method: subclasses declare `basePath` and fill in `registerRoutes`;
 * this class owns router creation and guarantees routes register exactly once.
 *
 * Registration is lazy (first `getRouter()` call) rather than in the
 * constructor, because subclass constructor parameters (controllers,
 * validators…) are not assigned yet while the base constructor runs.
 */
export abstract class BaseRouter implements IRouteModule {
  abstract readonly basePath: string;

  private router: Router | null = null;

  getRouter(): Router {
    if (this.router === null) {
      this.router = Router();
      this.registerRoutes(this.router);
    }
    return this.router;
  }

  protected abstract registerRoutes(router: Router): void;
}
