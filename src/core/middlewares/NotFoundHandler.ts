import type { Request, Response } from 'express';

/** Catch-all for unmatched routes; mounted after every module router. */
export class NotFoundHandler {
  readonly handle = (_req: Request, res: Response): void => {
    res.status(404).json({ success: false, message: 'Route not found' });
  };
}
