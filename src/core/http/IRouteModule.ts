import type { Router } from 'express';

/** What a feature module exposes to the app: where it mounts and its router. */
export interface IRouteModule {
  /** Mount path relative to the API prefix, e.g. `/health`. */
  readonly basePath: string;
  /**
   * True when the module reads its own JSON body (with its own limit, after its own checks). The
   * app-wide parser, with its small default limit, then skips this module's paths.
   */
  readonly parsesOwnBody?: boolean;
  getRouter(): Router;
}
