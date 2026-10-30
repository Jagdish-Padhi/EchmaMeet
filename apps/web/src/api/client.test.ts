import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient } from './client';

// Test-only stand-ins for the network. They exercise how the client treats each kind of answer.
function answering(status: number, body: unknown, contentType = 'application/json'): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
    );
}

const healthy = {
  status: 'ok',
  service: 'chaosboard-server',
  nodeVersion: 'v22.22.2',
  checks: { database: 'ok' },
};

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('createApiClient', () => {
  it('returns a parsed health response', async () => {
    const client = createApiClient({ fetchFn: answering(200, healthy) });
    expect((await client.getHealth()).checks.database).toBe('ok');
  });

  it('reports a response that violates the contract', async () => {
    const client = createApiClient({ fetchFn: answering(200, { ...healthy, status: 'great' }) });
    const error = await failureOf(client.getHealth());
    expect(error.failure.kind).toBe('unexpected_response');
  });

  it('reports a problem details body with its stable code', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Service unavailable',
      status: 503,
      code: 'database_down',
    };
    const client = createApiClient({ fetchFn: answering(503, problem) });
    const error = await failureOf(client.getHealth());
    expect(error.failure.kind).toBe('problem');
    expect(error.message).toContain('database_down');
  });

  it('reports an error status whose body is not problem details', async () => {
    const client = createApiClient({ fetchFn: answering(502, { oops: true }) });
    const error = await failureOf(client.getHealth());
    expect(error.failure.kind).toBe('unexpected_response');
  });

  it('reports a body that is not JSON', async () => {
    const client = createApiClient({ fetchFn: answering(200, '<html></html>', 'text/html') });
    const error = await failureOf(client.getHealth());
    expect(error.failure.kind).toBe('unexpected_response');
  });

  it('reports network failures', async () => {
    const client = createApiClient({
      fetchFn: () => Promise.reject(new TypeError('connection refused')),
    });
    const error = await failureOf(client.getHealth());
    expect(error.failure).toEqual({ kind: 'network', message: 'connection refused' });
  });

  it('passes an abort through unchanged so callers can ignore it', async () => {
    const controller = new AbortController();
    const client = createApiClient({
      fetchFn: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    });
    const pending = client.getHealth(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
