import type { IRouteModule } from '../../core/http/IRouteModule.js';
import { HealthController } from './HealthController.js';
import { HealthRouter } from './HealthRouter.js';

/** Wires the health feature. Each module exposes one factory like this. */
export function createHealthModule(): IRouteModule {
  return new HealthRouter(new HealthController());
}
