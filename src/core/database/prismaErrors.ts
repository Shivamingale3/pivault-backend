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

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const toFieldList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return [value];
  return undefined;
};

/**
 * Columns behind a unique-constraint violation, or `undefined` if `error` is not one.
 * Prisma reports them in `meta.target` (classic engine) or under
 * `meta.driverAdapterError.cause.constraint.fields` (driver adapters, Prisma 7).
 * Falls back to an empty list when the shape is unknown.
 */
export function uniqueViolationFields(error: unknown): string[] | undefined {
  if (!isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) return undefined;
  const meta = asRecord(error.meta);
  const fromTarget = toFieldList(meta?.['target']);
  if (fromTarget) return fromTarget;
  const cause = asRecord(asRecord(meta?.['driverAdapterError'])?.['cause']);
  return toFieldList(asRecord(cause?.['constraint'])?.['fields']) ?? [];
}
