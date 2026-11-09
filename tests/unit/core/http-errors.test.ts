import { describe, it, expect } from 'vitest';
import { AppError } from '../../../src/core/errors/AppError.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../../src/core/errors/HttpErrors.js';

describe('HTTP error hierarchy', () => {
  it.each([
    [BadRequestError, 400, 'Bad request'],
    [UnauthorizedError, 401, 'Unauthorized'],
    [ForbiddenError, 403, 'Forbidden'],
    [NotFoundError, 404, 'Resource not found'],
    [ConflictError, 409, 'Resource already exists'],
    [TooManyRequestsError, 429, 'Too many requests, please try again later.'],
    [InternalServerError, 500, 'Internal Server Error'],
  ])('%o has status %i and a default message', (ErrorClass, status, defaultMessage) => {
    const err = new ErrorClass();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(status);
    expect(err.message).toBe(defaultMessage);
    expect(err.name).toBe(ErrorClass.name);
    expect(err.isOperational).toBe(true);
  });

  it('accepts a custom message', () => {
    expect(new NotFoundError('User not found').message).toBe('User not found');
  });

  it('preserves the cause for debugging', () => {
    const cause = new Error('root');
    expect(new ConflictError('dup', { cause }).cause).toBe(cause);
  });

  it('preserves the stack trace', () => {
    expect(new BadRequestError().stack).toBeTruthy();
  });

  it('HttpError supports arbitrary status codes', () => {
    const err = new HttpError(499, 'Client closed request');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(499);
    expect(err.message).toBe('Client closed request');
  });
});
