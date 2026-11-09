import { describe, it, expect } from 'vitest';
import { ApiResponse } from '../../../src/core/http/ApiResponse.js';

describe('ApiResponse', () => {
  it('success() returns an object with success=true', () => {
    const res = ApiResponse.success('ok', { a: 1 });
    expect(res.success).toBe(true);
  });

  it('success() carries the given message', () => {
    const res = ApiResponse.success('created', null);
    expect(res.message).toBe('created');
  });

  it('success() carries the given data', () => {
    const payload = { x: 1, y: [2, 3] };
    const res = ApiResponse.success('ok', payload);
    expect(res.data).toEqual(payload);
  });

  it('error() returns an object with success=false', () => {
    const res = ApiResponse.error('bad', { a: 1 });
    expect(res.success).toBe(false);
  });

  it('error() carries the given message', () => {
    const res = ApiResponse.error('failed', null);
    expect(res.message).toBe('failed');
  });

  it('error() carries the given data', () => {
    const payload = ['e1', 'e2'];
    const res = ApiResponse.error('bad', payload);
    expect(res.data).toEqual(payload);
  });

  it('constructor sets all three fields', () => {
    const res = new ApiResponse(true, 'm', 42);
    expect(res).toEqual({ success: true, message: 'm', data: 42 });
  });
});
