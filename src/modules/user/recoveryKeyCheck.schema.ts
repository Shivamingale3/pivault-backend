import { z } from 'zod';
import {
  BASE64_PATTERN,
  CIPHERTEXT_MIN_LENGTH,
  ENVELOPE_ALGORITHM,
  ENVELOPE_VERSION,
  IV_BASE64_LENGTH,
} from '../vault/vault.constants.js';

/** The check is a few dozen bytes; anything bigger is not one. */
const CHECK_CIPHERTEXT_MAX_LENGTH = 256;

/**
 * The recovery-key check: the same envelope shape as a vault entry. The server validates the
 * shape only and can't open it.
 */
export const recoveryKeyCheckSchema = z
  .object({
    version: z.literal(ENVELOPE_VERSION),
    algorithm: z.literal(ENVELOPE_ALGORITHM),
    iv: z.string().length(IV_BASE64_LENGTH).regex(BASE64_PATTERN),
    ciphertext: z
      .string()
      .min(CIPHERTEXT_MIN_LENGTH)
      .max(CHECK_CIPHERTEXT_MAX_LENGTH)
      .regex(BASE64_PATTERN),
  })
  .strict();
