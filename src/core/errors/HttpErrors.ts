import { AppError } from './AppError.js';

/** Escape hatch for status codes without a dedicated subclass (e.g. 418, 499). */
export class HttpError extends AppError {}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', options?: ErrorOptions) {
    super(400, message, options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options?: ErrorOptions) {
    super(401, message, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', options?: ErrorOptions) {
    super(403, message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', options?: ErrorOptions) {
    super(404, message, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', options?: ErrorOptions) {
    super(409, message, options);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later.', options?: ErrorOptions) {
    super(429, message, options);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', options?: ErrorOptions) {
    super(500, message, options);
  }
}
