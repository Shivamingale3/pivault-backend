import { z } from 'zod';
import {
  BASE64_PATTERN,
  CIPHERTEXT_MAX_LENGTH,
  CIPHERTEXT_MIN_LENGTH,
  ENTRY_ID_PATTERN,
  ENVELOPE_ALGORITHM,
  ENVELOPE_VERSION,
  IV_BASE64_LENGTH,
  MAX_TIMESTAMP_MS,
  PULL_DEFAULT_LIMIT,
  PULL_MAX_LIMIT,
  PUSH_MAX_ROWS,
} from './vault.constants.js';

const envelope = z
  .object({
    version: z.literal(ENVELOPE_VERSION),
    algorithm: z.literal(ENVELOPE_ALGORITHM),
    iv: z.string().length(IV_BASE64_LENGTH).regex(BASE64_PATTERN),
    ciphertext: z
      .string()
      .min(CIPHERTEXT_MIN_LENGTH)
      .max(CIPHERTEXT_MAX_LENGTH)
      .regex(BASE64_PATTERN),
  })
  .strict();

/** One entry as RxDB replication sends it (`_deleted` is RxDB's own field name). */
const documentState = z
  .object({
    id: z.string().regex(ENTRY_ID_PATTERN),
    updatedAt: z.number().int().min(0).max(MAX_TIMESTAMP_MS),
    _deleted: z.boolean(),
    envelope,
  })
  .strict();

export const pullSchema = z
  .object({
    checkpoint: z
      .object({ seq: z.number().int().min(0) })
      .strict()
      .nullable(),
    limit: z.number().int().min(1).max(PULL_MAX_LIMIT).default(PULL_DEFAULT_LIMIT),
  })
  .strict();

export const pushSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            assumedMasterState: documentState.nullable(),
            newDocumentState: documentState,
          })
          .strict(),
      )
      .min(1)
      .max(PUSH_MAX_ROWS),
  })
  .strict();

export type DocumentDto = z.output<typeof documentState>;
export type PullInput = z.output<typeof pullSchema>;
export type PushInput = z.output<typeof pushSchema>;
