import { z } from 'zod';
import { passwordSchema } from '../user/password.schema.js';
import { INVALID_LINK_MESSAGE, LINK_TOKEN_LENGTH } from './passwordLink.constants.js';

const token = z
  .string({ error: INVALID_LINK_MESSAGE })
  .length(LINK_TOKEN_LENGTH, INVALID_LINK_MESSAGE)
  .regex(/^[A-Za-z0-9_-]+$/, INVALID_LINK_MESSAGE);

export const validateLinkSchema = z.object({ token }).strict();

export const completeLinkSchema = z.object({ token, password: passwordSchema }).strict();

export type ValidateLinkInput = z.output<typeof validateLinkSchema>;
export type CompleteLinkInput = z.output<typeof completeLinkSchema>;
