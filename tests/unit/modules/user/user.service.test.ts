import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { NotFoundError } from '../../../../src/core/errors/HttpErrors.js';
import { UserConflictError } from '../../../../src/modules/user/user.errors.js';
import { UserService } from '../../../../src/modules/user/UserService.js';
import { userData } from '../../../helpers/fixtures.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

let repo: InMemoryUserRepository;
let service: UserService;

beforeEach(() => {
  repo = new InMemoryUserRepository();
  service = new UserService(repo);
});

describe('UserService', () => {
  it('creates a user without exposing the password hash', async () => {
    const user = await service.create(userData());
    expect(user).not.toHaveProperty('passwordHash');
    expect(await service.getById(user.id)).toEqual(user);
  });

  it('reports which unique field clashed', async () => {
    const first = userData();
    await service.create(first);
    await expect(service.create(userData({ email: first.email }))).rejects.toMatchObject({
      field: 'email',
      statusCode: 409,
    });
    await expect(service.create(userData({ mobile: first.mobile }))).rejects.toBeInstanceOf(
      UserConflictError,
    );
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(service.getById(ulid())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marks the recovery key once and keeps the first timestamp', async () => {
    const user = await service.create(userData());
    const first = new Date('2026-11-01T00:00:00Z');
    await service.markRecoveryKeyConfigured(user.id, first);
    await service.markRecoveryKeyConfigured(user.id, new Date());
    expect((await service.getById(user.id)).recoveryKeyConfiguredAt).toEqual(first);
    await expect(service.markRecoveryKeyConfigured(ulid())).rejects.toBeInstanceOf(NotFoundError);
  });
});
