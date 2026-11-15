import type { ILogger } from '../../core/logger/ILogger.js';
import type { IVaultRepository, IVaultTransaction } from './IVaultRepository.js';
import { PULL_DEFAULT_LIMIT } from './vault.constants.js';
import type {
  PullCheckpoint,
  PullResult,
  PushCounts,
  PushResult,
  PushRow,
  VaultRecord,
  VaultState,
} from './vault.types.js';

/** Same content: used to spot a retried push and to check what a device last saw. */
const sameState = (a: VaultState, b: VaultState): boolean =>
  a.updatedAt === b.updatedAt &&
  a.deleted === b.deleted &&
  a.envelope.version === b.envelope.version &&
  a.envelope.algorithm === b.envelope.algorithm &&
  a.envelope.iv === b.envelope.iv &&
  a.envelope.ciphertext === b.envelope.ciphertext;

/**
 * Stores and returns encrypted entries for the RxDB replication protocol. It only compares and
 * relays opaque blobs: it can't decrypt anything, and never logs entry contents or ids.
 */
export class VaultService {
  constructor(
    private readonly vault: IVaultRepository,
    private readonly logger: ILogger,
  ) {}

  /** Changes after the checkpoint, in change order. The checkpoint moves to the last one returned. */
  async pull(
    userId: string,
    checkpoint: PullCheckpoint | null,
    limit: number = PULL_DEFAULT_LIMIT,
  ): Promise<PullResult> {
    const after = checkpoint?.seq ?? 0;
    const documents = await this.vault.listAfter(userId, after, limit);
    const last = documents.at(-1);
    return { documents, checkpoint: { seq: last?.seq ?? after } };
  }

  /**
   * Applies a device's local changes. A change is accepted only when the device's idea of the
   * server state (`assumedMasterState`) is still true; otherwise the server's version is sent back
   * as a conflict and the device resolves it. Re-sending an already applied change is harmless.
   */
  async push(userId: string, rows: PushRow[]): Promise<PushResult> {
    const result = await this.vault.runExclusive(userId, async (tx) => {
      const conflicts: VaultRecord[] = [];
      const counts: PushCounts = { created: 0, updated: 0, deleted: 0 };
      for (const row of rows) {
        const conflict = await this.applyRow(tx, row, counts);
        if (conflict) conflicts.push(conflict);
      }
      return { conflicts, counts };
    });
    const { created, updated, deleted } = result.counts;
    this.logger.info(
      `Vault push for user ${userId}: ${String(created)} created, ${String(updated)} updated, ${String(deleted)} deleted, ${String(result.conflicts.length)} conflicts.`,
    );
    return result;
  }

  private async applyRow(
    tx: IVaultTransaction,
    { assumedMasterState, newDocumentState }: PushRow,
    counts: PushCounts,
  ): Promise<VaultRecord | null> {
    const master = await tx.find(newDocumentState.id);
    if (master && sameState(master, newDocumentState)) return null;
    if (master && !(assumedMasterState && sameState(master, assumedMasterState))) return master;

    await tx.save(newDocumentState);
    if (newDocumentState.deleted && !master?.deleted) counts.deleted += 1;
    else if (master) counts.updated += 1;
    else counts.created += 1;
    return null;
  }
}
