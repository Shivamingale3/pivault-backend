import { z } from 'zod';
import { paginationQuerySchema } from '../../core/http/Pagination.js';

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

/** Trimmed + lowercased before validation so `A@X.com ` and `a@x.com` are the same user. */
const emailField = z
  .string({ error: 'email is required' })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: 'email must be a valid email address' })
      .max(MAX_EMAIL_LENGTH, `email must be at most ${MAX_EMAIL_LENGTH} characters`),
  );

const nameField = z
  .string({ error: 'name must be a string' })
  .trim()
  .min(1, 'name cannot be empty')
  .max(MAX_NAME_LENGTH, `name must be at most ${MAX_NAME_LENGTH} characters`);

/** Unknown keys (e.g. a client-supplied `id`) are stripped by default. */
export const createUserSchema = z.object({
  email: emailField,
  name: nameField.optional(),
});

export const updateUserSchema = z
  .object({
    email: emailField.optional(),
    name: nameField.nullable().optional(),
  })
  .refine((data) => data.email !== undefined || data.name !== undefined, {
    error: 'At least one field (email, name) must be provided',
  });

export const userIdParamsSchema = z.object({
  id: z.ulid({ error: 'id must be a valid ULID' }),
});

export const listUsersQuerySchema = paginationQuerySchema;

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
