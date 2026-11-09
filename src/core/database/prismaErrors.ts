import { Prisma } from '@prisma/client';

/** Prisma error codes the app reacts to. Full list: https://pris.ly/d/prisma-errors */
export const PrismaErrorCode = {
  UniqueConstraintViolation: 'P2002',
  RecordNotFound: 'P2025',
} as const;

export type PrismaErrorCodeValue = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode];

export function isPrismaError(
  error: unknown,
  code: PrismaErrorCodeValue,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
