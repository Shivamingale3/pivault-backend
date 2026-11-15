import { beforeEach, describe, expect, it } from 'vitest';
import { VaultService } from '../../../../src/modules/vault/VaultService.js';
import type { PushRow } from '../../../../src/modules/vault/vault.types.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryVaultRepository } from '../../../helpers/InMemoryVaultRepository.js';
import { fakeState, nextVersion } from '../../../helpers/vaultFixtures.js';

const ALICE = 'alice';
const BOB = 'bob';

let repo: InMemoryVaultRepository;
let logger: ReturnType<typeof createFakeLogger>;
let service: VaultService;

beforeEach(() => {
  repo = new InMemoryVaultRepository();
  logger = createFakeLogger();
  service = new VaultService(repo, logger);
});

const insert = (state = fakeState()): PushRow => ({
  assumedMasterState: null,
  newDocumentState: state,
});

describe('push: new entries', () => {
  it('stores them, numbers them in order, and counts them as created', async () => {
    const [a, b] = [fakeState(), fakeState()];
    const result = await service.push(ALICE, [insert(a), insert(b)]);

    expect(result.conflicts).toEqual([]);
    expect(result.counts).toEqual({ created: 2, updated: 0, deleted: 0 });
    const pulled = await service.pull(ALICE, null);
    expect(pulled.documents.map((d) => [d.id, d.seq])).toEqual([
      [a.id, 1],
      [b.id, 2],
    ]);
    expect(pulled.documents[0]?.envelope).toEqual(a.envelope);
  });

  it('is harmless to send the same push again (a retry after a lost response)', async () => {
    const row = insert();
    await service.push(ALICE, [row]);
    const again = await service.push(ALICE, [row]);
    expect(again.conflicts).toEqual([]);
    expect(again.counts).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect((await service.pull(ALICE, null)).documents).toHaveLength(1);
  });

  it('keeps every user separate, even for the same entry id', async () => {
    const state = fakeState();
    await service.push(ALICE, [insert(state)]);
    await service.push(BOB, [insert({ ...state, updatedAt: state.updatedAt + 5 })]);

    expect((await service.pull(ALICE, null)).documents[0]?.updatedAt).toBe(state.updatedAt);
    expect((await service.pull(BOB, null)).documents[0]?.updatedAt).toBe(state.updatedAt + 5);
    expect((await service.pull('carol', null)).documents).toEqual([]);
  });
});

describe('push: changes', () => {
  it('accepts an update when the device saw the latest version', async () => {
    const v1 = fakeState();
    await service.push(ALICE, [insert(v1)]);
    const v2 = nextVersion(v1);
    const result = await service.push(ALICE, [{ assumedMasterState: v1, newDocumentState: v2 }]);

    expect(result.conflicts).toEqual([]);
    expect(result.counts).toEqual({ created: 0, updated: 1, deleted: 0 });
    const [stored] = (await service.pull(ALICE, null)).documents;
    expect(stored).toMatchObject({ id: v1.id, seq: 2, updatedAt: v2.updatedAt });
    expect(stored?.envelope).toEqual(v2.envelope);
  });

  it("returns the server's version as a conflict when the device's view is stale", async () => {
    const v1 = fakeState();
    await service.push(ALICE, [insert(v1)]);
    const fromOtherDevice = nextVersion(v1);
    await service.push(ALICE, [{ assumedMasterState: v1, newDocumentState: fromOtherDevice }]);

    const stale = nextVersion(v1);
    const result = await service.push(ALICE, [{ assumedMasterState: v1, newDocumentState: stale }]);

    expect(result.counts).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({ id: v1.id, updatedAt: fromOtherDevice.updatedAt });
    expect((await service.pull(ALICE, null)).documents[0]?.envelope).toEqual(
      fromOtherDevice.envelope,
    );
  });

  it('conflicts when a device claims the entry is new but the server already has it', async () => {
    const state = fakeState();
    await service.push(ALICE, [insert(state)]);
    const result = await service.push(ALICE, [insert(fakeState({ id: state.id }))]);
    expect(result.conflicts).toHaveLength(1);
  });

  it('applies the good rows of a batch and reports the conflicting ones', async () => {
    const existing = fakeState();
    await service.push(ALICE, [insert(existing)]);
    const fresh = fakeState();
    const result = await service.push(ALICE, [
      insert(fakeState({ id: existing.id })),
      insert(fresh),
    ]);
    expect(result.counts.created).toBe(1);
    expect(result.conflicts.map((c) => c.id)).toEqual([existing.id]);
  });
});

describe('push: deletes', () => {
  it('stores a tombstone that other devices can pull', async () => {
    const v1 = fakeState();
    await service.push(ALICE, [insert(v1)]);
    const gone = nextVersion(v1, { deleted: true });
    const result = await service.push(ALICE, [{ assumedMasterState: v1, newDocumentState: gone }]);

    expect(result.counts).toEqual({ created: 0, updated: 0, deleted: 1 });
    const [stored] = (await service.pull(ALICE, null)).documents;
    expect(stored).toMatchObject({ id: v1.id, deleted: true });
  });

  it('keeps a tombstone for an entry the server never saw', async () => {
    const result = await service.push(ALICE, [insert(fakeState({ deleted: true }))]);
    expect(result.counts).toEqual({ created: 0, updated: 0, deleted: 1 });
  });

  it('lets an entry come back after a delete, counted as an update', async () => {
    const v1 = fakeState();
    await service.push(ALICE, [insert(v1)]);
    const gone = nextVersion(v1, { deleted: true });
    await service.push(ALICE, [{ assumedMasterState: v1, newDocumentState: gone }]);
    const back = nextVersion(gone, { deleted: false });
    const result = await service.push(ALICE, [
      { assumedMasterState: gone, newDocumentState: back },
    ]);
    expect(result.counts).toEqual({ created: 0, updated: 1, deleted: 0 });
  });
});

describe('pull', () => {
  it('pages through changes with a checkpoint and never repeats or skips one', async () => {
    const states = Array.from({ length: 5 }, () => fakeState());
    await service.push(
      ALICE,
      states.map((state) => insert(state)),
    );

    const first = await service.pull(ALICE, null, 2);
    expect(first.documents.map((d) => d.id)).toEqual([states[0]?.id, states[1]?.id]);
    expect(first.checkpoint).toEqual({ seq: 2 });
    const second = await service.pull(ALICE, first.checkpoint, 2);
    expect(second.documents.map((d) => d.id)).toEqual([states[2]?.id, states[3]?.id]);
    const third = await service.pull(ALICE, second.checkpoint, 2);
    expect(third.documents.map((d) => d.id)).toEqual([states[4]?.id]);
    const done = await service.pull(ALICE, third.checkpoint, 2);
    expect(done.documents).toEqual([]);
    expect(done.checkpoint).toEqual(third.checkpoint);
  });

  it('lists an updated entry again, at its new place in the change order', async () => {
    const [a, b] = [fakeState(), fakeState()];
    await service.push(ALICE, [insert(a), insert(b)]);
    const checkpoint = (await service.pull(ALICE, null)).checkpoint;
    await service.push(ALICE, [{ assumedMasterState: a, newDocumentState: nextVersion(a) }]);

    const changes = await service.pull(ALICE, checkpoint);
    expect(changes.documents.map((d) => [d.id, d.seq])).toEqual([[a.id, 3]]);
  });

  it('starts at zero when the device has no checkpoint yet', async () => {
    expect(await service.pull(ALICE, null)).toEqual({ documents: [], checkpoint: { seq: 0 } });
  });
});

describe('integrity and privacy', () => {
  it('all-or-nothing: a failing batch changes nothing and wastes no numbers', async () => {
    const good = fakeState();
    const original = repo.runExclusive.bind(repo);
    let calls = 0;
    repo.runExclusive = ((userId, work) =>
      original(userId, async (tx) =>
        work({
          find: tx.find.bind(tx),
          save: async (state) => {
            calls += 1;
            if (calls === 2) throw new Error('disk full');
            return tx.save(state);
          },
        }),
      )) as typeof repo.runExclusive;

    await expect(service.push(ALICE, [insert(good), insert(fakeState())])).rejects.toThrow(
      'disk full',
    );
    expect((await service.pull(ALICE, null)).documents).toEqual([]);
    repo.runExclusive = original;
    await service.push(ALICE, [insert(good)]);
    expect((await service.pull(ALICE, null)).documents[0]?.seq).toBe(1);
  });

  it('serializes pushes of one user: parallel pushes get distinct, ordered numbers', async () => {
    const states = Array.from({ length: 6 }, () => fakeState());
    await Promise.all(states.map((state) => service.push(ALICE, [insert(state)])));
    const seqs = (await service.pull(ALICE, null)).documents.map((d) => d.seq);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never logs ids, keys or ciphertext', async () => {
    const state = fakeState();
    await service.push(ALICE, [insert(state)]);
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain(state.id);
    expect(logged).not.toContain(state.envelope.ciphertext);
    expect(logged).not.toContain(state.envelope.iv);
  });
});
