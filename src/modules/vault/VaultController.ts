import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';
import { authOf } from '../session/SessionAuthGuard.js';
import type { DocumentDto, PullInput, PushInput } from './vault.schema.js';
import type { VaultRecord, VaultState } from './vault.types.js';
import type { VaultService } from './VaultService.js';

const toDto = ({ id, updatedAt, deleted, envelope }: VaultRecord): DocumentDto => ({
  id,
  updatedAt,
  _deleted: deleted,
  envelope: {
    version: envelope.version as 1,
    algorithm: envelope.algorithm as 'AES-GCM-256',
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
  },
});

const toState = ({ id, updatedAt, _deleted, envelope }: DocumentDto): VaultState => ({
  id,
  updatedAt,
  deleted: _deleted,
  envelope,
});

/** Bodies were already validated by the router. */
export class VaultController extends BaseController {
  constructor(private readonly service: VaultService) {
    super();
  }

  readonly pull = async (req: Request, res: Response): Promise<void> => {
    const { checkpoint, limit } = req.body as PullInput;
    const result = await this.service.pull(authOf(res).userId, checkpoint, limit);
    this.ok(res, 'Vault changes', {
      documents: result.documents.map(toDto),
      checkpoint: result.checkpoint,
      remaining: result.remaining,
    });
  };

  readonly push = async (req: Request, res: Response): Promise<void> => {
    const { rows } = req.body as PushInput;
    const result = await this.service.push(
      authOf(res).userId,
      rows.map((row) => ({
        assumedMasterState: row.assumedMasterState ? toState(row.assumedMasterState) : null,
        newDocumentState: toState(row.newDocumentState),
      })),
    );
    this.ok(res, 'Vault changes saved', {
      conflicts: result.conflicts.map(toDto),
      counts: result.counts,
    });
  };
}
