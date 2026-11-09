import type { PrismaClient } from '@prisma/client';
import type { RateLimitKey } from '../../core/constants/ratelimits.constants.js';
import type { IDatabase } from '../../core/database/IDatabase.js';
import type { IRouteModule } from '../../core/http/IRouteModule.js';
import type { RateLimiterFactory } from '../../core/middlewares/RateLimiterFactory.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import { PrismaUserRepository } from './PrismaUserRepository.js';
import { UserController } from './UserController.js';
import { UserRouter } from './UserRouter.js';
import { UserService } from './UserService.js';

export interface UserModuleDependencies {
  database: IDatabase<PrismaClient>;
  validator: RequestValidator;
  rateLimiterFactory: RateLimiterFactory<RateLimitKey>;
}

/** Wires repository → service → controller → router for the user feature. */
export function createUserModule(deps: UserModuleDependencies): IRouteModule {
  const repository = new PrismaUserRepository(deps.database.client);
  const service = new UserService(repository);
  const controller = new UserController(service);
  return new UserRouter(controller, deps.validator, deps.rateLimiterFactory);
}
