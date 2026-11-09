import { describe, it, expect } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { NoopLogger } from '../../../../src/core/logger/NoopLogger.js';
import { ErrorHandler } from '../../../../src/core/middlewares/ErrorHandler.js';
import { AppErrorMapper } from '../../../../src/core/middlewares/errorMappers/AppErrorMapper.js';
import { RequestValidator } from '../../../../src/core/middlewares/RequestValidator.js';

const validator = new RequestValidator();
const errorHandler = new ErrorHandler(new NoopLogger(), [new AppErrorMapper()]);

/** Mini app with the real error handler so responses match production. */
function buildApp(register: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  register(app);
  app.use(errorHandler.handle);
  return app;
}

describe('RequestValidator', () => {
  it('replaces req.body with the parsed value (coerced, stripped)', async () => {
    const schema = z.object({ age: z.coerce.number(), name: z.string().trim() });
    const app = buildApp((a) =>
      a.post('/t', validator.validate(schema), (req, res) => {
        res.json(req.body);
      }),
    );
    const res = await request(app).post('/t').send({ age: '42', name: '  ann ', extra: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ age: 42, name: 'ann' });
  });

  it('replaces req.query with defaults applied', async () => {
    const schema = z.object({ page: z.coerce.number().default(1) });
    const app = buildApp((a) =>
      a.get('/t', validator.validate(schema, 'query'), (req, res) => {
        res.json(req.query);
      }),
    );
    const res = await request(app).get('/t');
    expect(res.body).toEqual({ page: 1 });
  });

  it('replaces req.params with the parsed value', async () => {
    const schema = z.object({ id: z.coerce.number().int() });
    const app = buildApp((a) =>
      a.get('/t/:id', validator.validate(schema, 'params'), (req, res) => {
        res.json({ id: req.params['id'], type: typeof req.params['id'] });
      }),
    );
    const res = await request(app).get('/t/7');
    expect(res.body).toEqual({ id: 7, type: 'number' });
  });

  it('responds 400 with the first validation message on invalid input', async () => {
    const schema = z.object({ email: z.email({ error: 'Invalid email' }) });
    const app = buildApp((a) =>
      a.post('/t', validator.validate(schema), (_req, res) => {
        res.json({ reached: true });
      }),
    );
    const res = await request(app).post('/t').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid email' });
  });
});
