/** Client-safe description of an error: what status to send and what to say. */
export interface MappedError {
  statusCode: number;
  message: string;
}

/**
 * One link in the error-handling chain. Returns a `MappedError` when it
 * recognises the error, or `null` to let the next mapper try.
 * Add new error sources (ORM, auth library…) by adding a mapper — the
 * `ErrorHandler` itself never changes (Open/Closed).
 */
export interface IErrorMapper {
  map(error: unknown): MappedError | null;
}
