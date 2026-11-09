import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ConflictError, InternalServerError } from '../../../../src/core/errors/HttpErrors.js';
import { ErrorHandler } from '../../../../src/core/middlewares/ErrorHandler.js';
import { AppErrorMapper } from '../../../../src/core/middlewares/errorMappers/AppErrorMapper.js';
import { BodyParserErrorMapper } from '../../../../src/core/middlewares/errorMappers/BodyParserErrorMapper.js';
import type { IErrorMapper } from '../../../../src/core/middlewares/errorMappers/IErrorMapper.js';
import { ZodErrorMapper } from '../../../../src/core/middlewares/errorMappers/ZodErrorMapper.js';
import { createFakeLogger } from '../../../helpers/fakes.js';

function createRes(headersSent = false) {
  const res = { headersSent, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const req = { method: 'GET', originalUrl: '/api/x' } as Request;

function run(err: unknown, mappers?: IErrorMapper[]) {
  const logger = createFakeLogger();
  const handler = new ErrorHandler(
    logger,
    mappers ?? [new AppErrorMapper(), new ZodErrorMapper(), new BodyParserErrorMapper()],
  );
  const res = createRes();
  const next = vi.fn();
  handler.handle(err, req, res as unknown as Response, next as NextFunction);
  return { res, next, logger };
}

describe('ErrorHandler', () => {
  it('maps an AppError to its status and message, logged as a warning for 4xx', () => {
    const { res, logger } = run(new ConflictError('Email taken'));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Email taken' });
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs 5xx AppErrors at error level', () => {
    const { res, logger } = run(new InternalServerError());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('maps a ZodError to 400 with the first issue message', () => {
    const zodError = z.object({ a: z.string({ error: 'a is required' }) }).safeParse({}).error;
    const { res } = run(zodError);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'a is required' });
  });

  it('maps a body-parser failure to 400 with a fixed message', () => {
    const parseError = Object.assign(new SyntaxError('Unexpected token } in JSON'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    const { res } = run(parseError);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Malformed JSON body' });
  });

  it('answers unknown errors with a generic 500 and logs the stack', () => {
    const { res, logger } = run(new Error('db password is hunter2'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal Server Error' });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('hunter2'));
  });

  it('handles non-Error throwables', () => {
    const { res } = run('a string was thrown');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('uses the first mapper that recognises the error', () => {
    const first = { map: vi.fn(() => ({ statusCode: 418, message: 'teapot' })) };
    const second = { map: vi.fn(() => ({ statusCode: 400, message: 'nope' })) };
    const { res } = run(new Error('x'), [first, second]);
    expect(res.status).toHaveBeenCalledWith(418);
    expect(second.map).not.toHaveBeenCalled();
  });

  it('delegates to next() when headers were already sent', () => {
    const handler = new ErrorHandler(createFakeLogger(), [new AppErrorMapper()]);
    const res = createRes(true);
    const next = vi.fn();
    const err = new Error('late');
    handler.handle(err, req, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
