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
 * Prisma 7.10+ driver adapters report the violated index by name, e.g. `users_countryCode_mobile_key`
 * (`<table>_<columns joined by _>_key`, Prisma's default naming). Recovers the columns from it.
 */
const fieldsFromIndexName = (index: unknown, table: unknown): string[] | undefined => {
  if (typeof index !== 'string') return undefined;
  let name = index.replace(/_(key|idx)$/, '');
  if (typeof table === 'string' && name.startsWith(`${table}_`))
    name = name.slice(table.length + 1);
  return name.length > 0 ? name.split('_') : undefined;
};

/**
 * Columns behind a unique-constraint violation, or `undefined` if `error` is not one.
 * Prisma reports them in `meta.target` (classic engine), or for driver adapters (Prisma 7) under
 * `meta.driverAdapterError.cause.constraint` as `fields` (<= 7.9) or the `index` name (>= 7.10).
 * Falls back to an empty list when the shape is unknown.
 */
export function uniqueViolationFields(error: unknown): string[] | undefined {
  if (!isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) return undefined;
  const meta = asRecord(error.meta);
  const fromTarget = toFieldList(meta?.['target']);
  if (fromTarget) return fromTarget;
  const cause = asRecord(asRecord(meta?.['driverAdapterError'])?.['cause']);
  const constraint = asRecord(cause?.['constraint']);
  return (
    toFieldList(constraint?.['fields']) ??
    fieldsFromIndexName(constraint?.['index'], cause?.['table']) ??
    []
  );
}
