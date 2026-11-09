/**
 * Base class for every *expected* (operational) error the API raises on purpose.
 *
 * Anything extending `AppError` is safe to show to the client: its message is
 * written for end users. Anything else reaching the error handler is treated
 * as a bug and answered with a generic 500.
 */
export abstract class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational = true;

  constructor(statusCode: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}
