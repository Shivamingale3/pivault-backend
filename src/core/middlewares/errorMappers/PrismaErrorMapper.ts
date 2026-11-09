import { isPrismaError, PrismaErrorCode } from '../../database/prismaErrors.js';
import type { IErrorMapper, MappedError } from './IErrorMapper.js';

/**
 * Safety net for Prisma errors a repository did not translate itself.
 * Answers with generic messages: raw Prisma messages name tables, columns
 * and constraints, which must never reach the client.
 */
export class PrismaErrorMapper implements IErrorMapper {
  map(error: unknown): MappedError | null {
    if (isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) {
      return { statusCode: 409, message: 'Resource already exists' };
    }
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      return { statusCode: 404, message: 'Resource not found' };
    }
    return null;
  }
}
