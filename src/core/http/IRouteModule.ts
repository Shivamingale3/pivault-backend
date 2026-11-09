import type { Router } from 'express';

/** What a feature module exposes to the app: where it mounts and its router. */
export interface IRouteModule {
  /** Mount path relative to the API prefix, e.g. `/health`. */
  readonly basePath: string;
  getRouter(): Router;
}
