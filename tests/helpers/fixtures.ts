import { ulid } from 'ulid';
import type { CreateUserData } from '../../src/modules/user/user.types.js';

/** Unique, valid user data; pass overrides to force clashes. */
export function userData(overrides: Partial<CreateUserData> = {}): CreateUserData {
  const suffix = ulid().slice(-8).toLowerCase();
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    email: `jane.${suffix}@example.com`,
    mobile: `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder',
    ...overrides,
  };
}
