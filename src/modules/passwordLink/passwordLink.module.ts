import type { IRouteModule } from '../../core/http/IRouteModule.js';
import { PasswordLinkController } from './PasswordLinkController.js';
import { PasswordLinkRouter, type PasswordLinkGuards } from './PasswordLinkRouter.js';
import type { PasswordLinkService } from './PasswordLinkService.js';

export function createPasswordLinkModule(
  service: PasswordLinkService,
  guards: PasswordLinkGuards,
): IRouteModule {
  return new PasswordLinkRouter(new PasswordLinkController(service), guards);
}
