import express, { type RequestHandler, type Router } from 'express';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import { noStore } from '../../core/middlewares/noStore.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import { recordBodyHash } from '../../core/crypto/bodyHash.js';
import { pullSchema, pushSchema } from './vault.schema.js';
import { VAULT_BODY_LIMIT } from './vault.constants.js';
import type { VaultController } from './VaultController.js';

export interface VaultGuards {
  /** The signed-session checks: `handle` before the body is read, `verifyBody` right after. */
  session: { handle: RequestHandler; verifyBody: RequestHandler };
  validator: RequestValidator;
}

/**
 * `/api/vault`: the RxDB replication endpoints. Everything needs a signed session. This router
 * reads its own, larger JSON body, and only AFTER the session is verified, so anonymous requests
 * never get more than the global body limit.
 */
export class VaultRouter extends BaseRouter {
  readonly basePath = '/vault';
  readonly parsesOwnBody = true;

  constructor(
    private readonly controller: VaultController,
    private readonly guards: VaultGuards,
  ) {
    super();
  }

  protected registerRoutes(router: Router): void {
    const { session, validator } = this.guards;
    router.use(noStore);
    router.use(session.handle);
    router.use(express.json({ limit: VAULT_BODY_LIMIT, verify: recordBodyHash }));
    router.use(session.verifyBody);
    router.post('/pull', validator.validate(pullSchema), this.controller.pull);
    router.post('/push', validator.validate(pushSchema), this.controller.push);
  }
}
