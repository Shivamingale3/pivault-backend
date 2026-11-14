import type { RequestHandler } from 'express';

/** Responses that carry or react to secrets must never be stored by browsers or proxies. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
