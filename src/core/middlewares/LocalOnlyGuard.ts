import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { NotFoundError } from '../errors/HttpErrors.js';
import type { ILogger } from '../logger/ILogger.js';

/** Set by reverse proxies; their presence means the request did not originate on this machine. */
const PROXY_HEADERS = ['x-forwarded-for', 'forwarded', 'x-real-ip'] as const;

const isLoopback = (address: string | undefined): boolean =>
  address !== undefined &&
  (address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.'));

/**
 * Lets a request through only when it came straight from this machine's loopback.
 * Everything else gets the same 404 an unknown route would, so the endpoint's
 * existence is not revealed. It checks the TCP peer (not `req.ip`, which honours
 * `trust proxy`) and rejects any request carrying proxy headers, so traffic relayed
 * by a reverse proxy on the same host is refused too.
 */
export class LocalOnlyGuard {
  constructor(private readonly logger: ILogger) {}

  readonly handle: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
    const proxied = PROXY_HEADERS.some((header) => req.headers[header] !== undefined);
    if (isLoopback(req.socket.remoteAddress) && !proxied) {
      next();
      return;
    }
    this.logger.warn(`Blocked non-local request to ${req.method} ${req.originalUrl}`);
    next(new NotFoundError('Route not found'));
  };
}
