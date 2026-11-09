import { ZodError } from 'zod';
import type { IErrorMapper, MappedError } from './IErrorMapper.js';

/** A ZodError escaping validation middleware still answers 400, not 500. */
export class ZodErrorMapper implements IErrorMapper {
  map(error: unknown): MappedError | null {
    if (!(error instanceof ZodError)) return null;
    return { statusCode: 400, message: error.issues[0]?.message ?? 'Validation failed' };
  }
}
