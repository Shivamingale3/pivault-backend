import type { NextFunction, Request, Response } from 'express';
import type { ILogger } from '../logger/ILogger.js';
import type { IErrorMapper, MappedError } from './errorMappers/IErrorMapper.js';

const GENERIC_ERROR_MESSAGE = 'Internal Server Error';

/**
 * Terminal Express error middleware (Chain of Responsibility).
 *
 * Mappers are asked in order; the first that recognises the error decides the
 * client-facing status and message. Unrecognised errors are bugs: their stack
 * is logged and the client only ever sees a generic 500.
 */
export class ErrorHandler {
  constructor(
    private readonly logger: ILogger,
    private readonly mappers: readonly IErrorMapper[],
  ) {}

  readonly handle = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const mapped = this.resolve(err);
    if (mapped) {
      const line = `${req.method} ${req.originalUrl} → ${mapped.statusCode}: ${mapped.message}`;
      if (mapped.statusCode >= 500) this.logger.error(line);
      else this.logger.warn(line);
      res.status(mapped.statusCode).json({ success: false, message: mapped.message });
      return;
    }

    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    res.status(500).json({ success: false, message: GENERIC_ERROR_MESSAGE });
  };

  private resolve(err: unknown): MappedError | null {
    for (const mapper of this.mappers) {
      const mapped = mapper.map(err);
      if (mapped) return mapped;
    }
    return null;
  }
}
