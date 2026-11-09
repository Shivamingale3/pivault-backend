import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaErrorMapper } from '../../../../src/core/middlewares/errorMappers/PrismaErrorMapper.js';

const mapper = new PrismaErrorMapper();

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`email`) in table `users`',
    { code, clientVersion: 'test' },
  );
}

describe('PrismaErrorMapper', () => {
  it('maps P2002 (unique constraint) to 409 with a generic message', () => {
    expect(mapper.map(prismaError('P2002'))).toEqual({
      statusCode: 409,
      message: 'Resource already exists',
    });
  });

  it('maps P2025 (record not found) to 404', () => {
    expect(mapper.map(prismaError('P2025'))).toEqual({
      statusCode: 404,
      message: 'Resource not found',
    });
  });

  it('never exposes the raw Prisma message (table/column names)', () => {
    expect(mapper.map(prismaError('P2002'))?.message).not.toMatch(/users|email/);
  });

  it('ignores other Prisma codes and non-Prisma errors', () => {
    expect(mapper.map(prismaError('P2003'))).toBeNull();
    expect(mapper.map(new Error('x'))).toBeNull();
    expect(mapper.map({ code: 'P2002' })).toBeNull();
  });
});
