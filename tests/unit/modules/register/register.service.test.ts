import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserConflictError } from '../../../../src/modules/user/user.errors.js';
import { UserService } from '../../../../src/modules/user/UserService.js';
import type { RegisterInput } from '../../../../src/modules/register/register.schema.js';
import { RegisterService } from '../../../../src/modules/register/RegisterService.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

const input: RegisterInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  countryCode: '91',
  mobile: '9876543210',
  password: 'Passw0rd!',
};

let repo: InMemoryUserRepository;
const makeHasher = () => ({
  hash: vi.fn((_password: string) => Promise.resolve('hashed')),
  verify: vi.fn((_hash: string, _password: string) => Promise.resolve(true)),
});
const makeQueue = () => ({ enqueue: vi.fn((..._args: unknown[]) => Promise.resolve('job-1')) });

let hasher: ReturnType<typeof makeHasher>;
let queue: ReturnType<typeof makeQueue>;
let logger: ReturnType<typeof createFakeLogger>;
let service: RegisterService;

beforeEach(() => {
  repo = new InMemoryUserRepository();
  hasher = makeHasher();
  queue = makeQueue();
  logger = createFakeLogger();
  service = new RegisterService(new UserService(repo), hasher, queue, logger);
});

describe('RegisterService', () => {
  it('stores the hash (never the password), splits the mobile and queues the welcome email', async () => {
    const { user, welcomeEmailQueued } = await service.register(input);

    const stored = repo.rows.get(user.id);
    expect(stored?.passwordHash).toBe('hashed');
    expect(JSON.stringify(stored)).not.toContain('Passw0rd!');
    expect(stored).toMatchObject({ countryCode: '91', mobile: '9876543210' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(hasher.hash).toHaveBeenCalledWith('Passw0rd!');
    expect(queue.enqueue).toHaveBeenCalledWith(
      'welcome',
      { userId: user.id },
      { jobId: `welcome-${user.id}` },
    );
    expect(welcomeEmailQueued).toBe(true);
  });

  it.each([
    ['email', { email: 'jane@example.com', mobile: '9000000001' }],
    ['mobile', { email: 'other@example.com' }],
  ])('rejects a duplicate %s and queues nothing', async (field, override) => {
    await service.register(input);
    queue.enqueue.mockClear();
    const duplicate = service.register({ ...input, ...override });
    await expect(duplicate).rejects.toBeInstanceOf(UserConflictError);
    await expect(duplicate).rejects.toMatchObject({ field });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('allows the same national number under a different country code', async () => {
    await service.register(input);
    await expect(
      service.register({ ...input, email: 'b@example.com', countryCode: '44' }),
    ).resolves.toBeDefined();
  });

  it('still registers when the queue is down, and reports it', async () => {
    queue.enqueue.mockRejectedValueOnce(new Error('redis down'));
    const result = await service.register(input);
    expect(result.welcomeEmailQueued).toBe(false);
    expect(repo.rows.size).toBe(1);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
