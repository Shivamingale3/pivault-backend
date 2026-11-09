/**
 * Logging abstraction. Application code depends on this interface only,
 * never on a concrete logging library (Dependency Inversion).
 */
export interface ILogger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}
