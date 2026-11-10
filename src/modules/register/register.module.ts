import type { IRouteModule } from '../../core/http/IRouteModule.js';
import { RegisterController } from './RegisterController.js';
import { RegisterRouter, type RegisterGuards } from './RegisterRouter.js';
import type { RegisterService } from './RegisterService.js';

export function createRegisterModule(
  service: RegisterService,
  guards: RegisterGuards,
): IRouteModule {
  return new RegisterRouter(new RegisterController(service), guards);
}
