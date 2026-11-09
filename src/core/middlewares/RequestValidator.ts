import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type z } from 'zod';
import { BadRequestError } from '../errors/HttpErrors.js';

export type RequestSource = 'body' | 'query' | 'params';

/**
 * Builds Zod validation middleware. On success the parsed (coerced,
 * defaulted, stripped) value replaces the raw request part, so handlers only
 * ever see validated data. On failure it forwards a 400 `BadRequestError`.
 */
export class RequestValidator {
  validate(schema: z.ZodType, source: RequestSource = 'body'): RequestHandler {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed: unknown = await schema.parseAsync(req[source]);
        RequestValidator.assign(req, source, parsed);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          next(
            new BadRequestError(error.issues[0]?.message ?? 'Validation failed', { cause: error }),
          );
          return;
        }
        next(error);
      }
    };
  }

  /**
   * Express 5 exposes `req.query` (and, on some routers, `req.params`) as
   * getter-only properties, so they must be redefined rather than assigned.
   */
  private static assign(req: Request, source: RequestSource, value: unknown): void {
    if (source === 'body') {
      req.body = value;
      return;
    }
    Object.defineProperty(req, source, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}
