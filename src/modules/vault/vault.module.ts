import type { IRouteModule } from '../../core/http/IRouteModule.js';
import { VaultController } from './VaultController.js';
import { VaultRouter, type VaultGuards } from './VaultRouter.js';
import type { VaultService } from './VaultService.js';

export function createVaultModule(service: VaultService, guards: VaultGuards): IRouteModule {
  return new VaultRouter(new VaultController(service), guards);
}
