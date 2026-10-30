import { problemDetailsSchema } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { openEventStream, parseWith, registerProblemHandlers, toProblem } from '../http-kit';

describe('parseWith', () => {
  const schema = z.strictObject({ name: z.string().min(1), count: z.number().int() });

  it('returns typed data for valid input', () => {
    expect(parseWith(schema, { name: 'x', count: 2 }, 'request')).toEqual({ name: 'x', count: 2 });
  });

  it('throws a validation error that lists every field problem', () => {
    try {
      parseWith(schema, { name: '', count: 1.5 }, 'request');
      expect.unreachable('parseWith should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.kind).toBe('validation');
      expect(appError.code).toBe('validation_failed');
      expect((appError.details as { path: string }[]).map((entry) => entry.path)).toEqual(
        expect.arrayContaining(['name', 'count']),
      );
    }
  });
});

describe('toProblem', () => {
  it('maps each error kind to a status', () => {
    const cases: [ConstructorParameters<typeof AppError>[0], number][] = [
      ['validation', 400],
      ['not_found', 404],
      ['conflict', 409],
      ['busy', 409],
      ['unavailable', 503],
      ['timeout', 504],
      ['internal', 500],
    ];
    for (const [kind, status] of cases) {
      expect(toProblem(new AppError(kind, 'some_code', 'message'), '/x').status).toBe(status);
    }
  });

  it('keeps the stable code and never leaks details of unexpected errors', () => {
    const known = toProblem(
      new AppError('busy', 'experiment_running', 'Another run is active.'),
      '/x',
    );
    expect(known.code).toBe('experiment_running');
    const unknown = toProblem(new Error('secret connection string'), '/x');
    expect(unknown.status).toBe(500);
    expect(unknown.detail).not.toContain('secret');
    expect(unknown.code).toBe('internal_error');
  });
});

describe('problem handlers and event streams on a real server', () => {
  const apps: FastifyInstance[] = [];

  async function server(): Promise<{ app: FastifyInstance; url: string }> {
    const app = Fastify();
    registerProblemHandlers(app);
    app.get('/boom', () => {
      throw new AppError('conflict', 'already_exists', 'It already exists.');
    });
    app.get('/crash', () => {
      throw new Error('internal detail');
    });
    app.get('/events', async (_request, reply) => {
      const stream = openEventStream(reply);
      stream.send({ id: '1', event: 'tick', data: { n: 1 } });
      stream.send({ id: '2', event: 'tick', data: { n: 2 } });
      stream.close();
      await stream.closed;
    });
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    apps.push(app);
    return { app, url };
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('serializes application errors as problem+json', async () => {
    const { url } = await server();
    const response = await fetch(`${url}/boom`);
    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(problemDetailsSchema.parse(await response.json()).code).toBe('already_exists');
  });

  it('hides unexpected failures behind a generic problem', async () => {
    const { url } = await server();
    const response = await fetch(`${url}/crash`);
    expect(response.status).toBe(500);
    const body = problemDetailsSchema.parse(await response.json());
    expect(JSON.stringify(body)).not.toContain('internal detail');
  });

  it('streams events in order using the server-sent events format', async () => {
    const { url } = await server();
    const response = await fetch(`${url}/events`);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('id: 1\nevent: tick\ndata: {"n":1}\n\n');
    expect(text.indexOf('"n":1')).toBeLessThan(text.indexOf('"n":2'));
  });
});
