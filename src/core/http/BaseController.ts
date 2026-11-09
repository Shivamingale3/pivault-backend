import type { Response } from 'express';
import { ApiResponse } from './ApiResponse.js';

/**
 * Shared response helpers so every controller answers with the same envelope.
 *
 * Controllers expose handlers as arrow-function properties so they keep
 * `this` when passed to Express by reference. Async handlers need no
 * try/catch: Express 5 forwards rejected promises to the error handler.
 */
export abstract class BaseController {
  protected ok(res: Response, message: string, data?: unknown): void {
    res.status(200).json(ApiResponse.success(message, data));
  }

  protected created(res: Response, message: string, data?: unknown): void {
    res.status(201).json(ApiResponse.success(message, data));
  }

  protected noContent(res: Response): void {
    res.status(204).end();
  }
}
