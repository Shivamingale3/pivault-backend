import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/** Reusable `?page=&pageSize=` query schema; extend it for module-specific filters. */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: 'page must be a number' })
    .int('page must be an integer')
    .min(1, 'page must be at least 1')
    .default(1),
  pageSize: z.coerce
    .number({ error: 'pageSize must be a number' })
    .int('pageSize must be an integer')
    .min(1, 'pageSize must be at least 1')
    .max(MAX_PAGE_SIZE, `pageSize must be at most ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationParams = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toSkipTake({ page, pageSize }: PaginationParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPage<T>(items: T[], total: number, params: PaginationParams): Paginated<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
