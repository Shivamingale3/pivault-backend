import { AppError } from '../../errors/AppError.js';
import type { IErrorMapper, MappedError } from './IErrorMapper.js';

/** Errors raised deliberately by the application carry their own status/message. */
export class AppErrorMapper implements IErrorMapper {
  map(error: unknown): MappedError | null {
    if (!(error instanceof AppError)) return null;
    return { statusCode: error.statusCode, message: error.message };
  }
}
