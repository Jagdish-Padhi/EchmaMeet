import { describe, expect, it } from 'vitest';
import { runIdSchema } from '@chaosboard/contracts';
import { ApiError, createApiClient } from './client';

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
      code: 'server_down',
    };
    const client = createApiClient({ fetchFn: answering(503, problem) });
    const error = await failureOf(client.getHealth());
    expect(error.failure.kind).toBe('problem');
    if (error.failure.kind === 'problem') {
      expect(error.failure.problem.code).toBe('server_down');
    }
  });

  it('validates topology responses from backend', async () => {
    const validTopologyResponse = {
      valid: true,
      topology: {
        schemaVersion: 1,
        id: 'fixture-topology',
        name: 'Fixture topology',
        source: 'scenario',
        entry: { nodeId: 'gateway' },
        nodes: [
          {
            id: 'gateway',
            label: 'Gateway',
            kind: 'service',
            processing: { distribution: 'constant', ms: 10 },
            concurrency: { maxWorkers: 20 },
            queue: { mode: 'bounded', maxDepth: 100 },
            ingressRateLimitRps: null,
          },
        ],
        edges: [
          {
            id: 'gateway-to-inventory',
            source: 'gateway',
            target: 'gateway',
            mode: 'sync_call',
            policy: {
              timeoutMs: 1000,
              retry: {
                maxAttempts: 2,
                backoffBaseMs: 50,
                backoffMultiplier: 2,
                maxBackoffMs: 500,
                jitter: 'full',
              },
              breaker: {
                enabled: false,
                failureThresholdPct: 50,
                windowRequests: 20,
                cooldownMs: 2000,
                halfOpenProbes: 2,
              },
              fallback: 'fail_fast_503',
              idempotency: { sendKey: false },
              pool: { maxConnections: 50 },
            },
          },
        ],
      },
    };

    const client = createApiClient({ fetchFn: answering(200, validTopologyResponse) });
    const res = await client.validateTopology({
      name: 'Fixture topology',
      source: 'canvas',
      entryRef: 'gateway',
      nodes: [
        {
          ref: 'gateway',
          label: 'Gateway',
          kind: 'service',
        },
      ],
      edges: [
        {
          sourceRef: 'gateway',
          targetRef: 'gateway',
          mode: 'sync_call',
        },
      ],
    });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.topology.id).toBe('fixture-topology');
    }
  });

  it('cancels experiment returning runId', async () => {
    const runId = runIdSchema.parse('run-12345678-abcd-1234-abcd-1234567890ab');
    const client = createApiClient({
      fetchFn: answering(200, { runId, status: 'cancelled' }),
    });
    const res = await client.cancelExperiment(runId);
    expect(res.status).toBe('cancelled');
    expect(res.runId).toBe(runId);
  });

  it('performs login and parses user session response', async () => {
    const mockAuthResponse = {
      token: 'cb_test_session_token_123',
      user: {
        userId: 'eng-alex-chen',
        name: 'Alex Chen',
        role: 'Staff SRE',
        avatar: 'AC',
        email: 'alex.chen@meta.internal',
      },
    };
    const client = createApiClient({
      fetchFn: answering(200, mockAuthResponse),
    });
    const res = await client.login({
      email: 'alex.chen@meta.internal',
      password: 'chaosboard123',
    });
    expect(res.token).toBe('cb_test_session_token_123');
    expect(res.user.name).toBe('Alex Chen');
  });

  it('fetches current authenticated user session', async () => {
    const client = createApiClient({
      fetchFn: answering(200, {
        user: {
          userId: 'eng-alex-chen',
          name: 'Alex Chen',
          role: 'Staff SRE',
          avatar: 'AC',
          email: 'alex.chen@meta.internal',
        },
      }),
    });
    const res = await client.getCurrentUser();
    expect(res.user.email).toBe('alex.chen@meta.internal');
  });
});
