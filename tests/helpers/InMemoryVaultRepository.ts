import type {
  IVaultRepository,
  IVaultTransaction,
} from '../../src/modules/vault/IVaultRepository.js';
import type { VaultRecord, VaultState } from '../../src/modules/vault/vault.types.js';

/** In-memory `IVaultRepository`: per-user entries and counter, serialized and all-or-nothing. */
export class InMemoryVaultRepository implements IVaultRepository {
  private readonly entries = new Map<string, Map<string, VaultRecord>>();
  private readonly counters = new Map<string, number>();
  private readonly queues = new Map<string, Promise<unknown>>();

  private entriesOf(userId: string): Map<string, VaultRecord> {
    let map = this.entries.get(userId);
    if (!map) {
      map = new Map();
      this.entries.set(userId, map);
    }
    return map;
  }

  listAfter(userId: string, afterSeq: number, limit: number): Promise<VaultRecord[]> {
    const found = [...this.entriesOf(userId).values()]
      .filter((record) => record.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit);
    return Promise.resolve(found.map((record) => structuredClone(record)));
  }

  runExclusive<T>(userId: string, work: (tx: IVaultTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const snapshot = structuredClone([...this.entriesOf(userId)]);
      const counter = this.counters.get(userId) ?? 0;
      const tx: IVaultTransaction = {
        find: (id) => Promise.resolve(structuredClone(this.entriesOf(userId).get(id) ?? null)),
        save: (state: VaultState) => {
          const seq = (this.counters.get(userId) ?? 0) + 1;
          this.counters.set(userId, seq);
          const record: VaultRecord = { ...structuredClone(state), seq };
          this.entriesOf(userId).set(state.id, record);
          return Promise.resolve(structuredClone(record));
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        this.entries.set(userId, new Map(snapshot));
        this.counters.set(userId, counter);
        throw error;
      }
    };
    const next = (this.queues.get(userId) ?? Promise.resolve()).then(run, run);
    this.queues.set(
      userId,
      next.catch(() => undefined),
    );
    return next;
  }
}
