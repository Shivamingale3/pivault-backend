import { describe, it, expect } from 'vitest';
import { buildPage, paginationQuerySchema, toSkipTake } from '../../../src/core/http/Pagination.js';

describe('paginationQuerySchema', () => {
  it('defaults to page 1, pageSize 20', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces query-string numbers', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it.each([
    [{ page: '0' }, 'page must be at least 1'],
    [{ page: '1.5' }, 'page must be an integer'],
    [{ page: 'abc' }, 'page must be a number'],
    [{ pageSize: '0' }, 'pageSize must be at least 1'],
    [{ pageSize: '101' }, 'pageSize must be at most 100'],
  ])('rejects %j with "%s"', (input, message) => {
    const result = paginationQuerySchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe('toSkipTake', () => {
  it.each([
    [
      { page: 1, pageSize: 20 },
      { skip: 0, take: 20 },
    ],
    [
      { page: 3, pageSize: 10 },
      { skip: 20, take: 10 },
    ],
  ])('%j → %j', (params, expected) => {
    expect(toSkipTake(params)).toEqual(expected);
  });
});

describe('buildPage', () => {
  it('computes totalPages by rounding up', () => {
    expect(buildPage(['a'], 21, { page: 2, pageSize: 10 })).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('reports 0 pages for an empty collection', () => {
    expect(buildPage([], 0, { page: 1, pageSize: 10 }).totalPages).toBe(0);
  });
});
