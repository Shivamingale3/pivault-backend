import { ConflictError } from '../../core/errors/HttpErrors.js';
import type { UniqueUserField } from './user.types.js';

const MESSAGES: Record<UniqueUserField, string> = {
  email: 'Email already in use',
  mobile: 'Mobile number already in use',
};

/** 409 that says which unique field clashed, so register can report it. */
export class UserConflictError extends ConflictError {
  constructor(
    readonly field: UniqueUserField,
    options?: ErrorOptions,
  ) {
    super(MESSAGES[field], options);
  }
}
