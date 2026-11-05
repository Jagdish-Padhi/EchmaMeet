import { describe, it, expect } from 'vitest';
import { parseScenarioSpec } from '../application/scenario-loader';

describe('benchmarks scenario loader', () => {
  const validSpec = {
    schemaVersion: 1,
    id: 'retry-storm',
    name: 'Synchronous retry storm',
    description: 'A caller with several immediate retries under downstream latency.',
    designedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
    expectedOutcome: 'VIOLATED',
    topology: {
      schemaVersion: 1,
      id: 'retry-topo',
      name: 'Retry Topo',
      source: 'scenario',
      entry: { nodeId: 'gateway' },
      nodes: [
        {
          id: 'gateway',
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 50 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    },
    faults: [],
    invariants: [],
    trialConfig: {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 500,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 12345,
      trials: 3,
    },
  };

  it('parses valid scenario spec successfully', () => {
    const parsed = parseScenarioSpec(validSpec);
    expect(parsed.id).toBe('retry-storm');
    expect(parsed.expectedOutcome).toBe('VIOLATED');
  });

  it('throws on invalid scenario data', () => {
    expect(() => parseScenarioSpec({ foo: 'bar' })).toThrow();
  });
});
