import { describe, it, expect } from 'vitest';
import { scenarioSpecSchema } from './scenario';

describe('scenarioSpecSchema', () => {
  const validScenario = {
    schemaVersion: 1,
    id: 'retry-storm',
    name: 'Synchronous retry storm',
    description: 'A service retries immediately under downstream latency.',
    designedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
    expectedOutcome: 'VIOLATED',
    topology: {
      schemaVersion: 1,
      id: 'topo-retry',
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

  it('parses a valid scenario specification', () => {
    const parsed = scenarioSpecSchema.parse(validScenario);
    expect(parsed.id).toBe('retry-storm');
    expect(parsed.expectedOutcome).toBe('VIOLATED');
  });

  it('rejects an invalid expectedOutcome', () => {
    const invalid = {
      ...validScenario,
      expectedOutcome: 'UNKNOWN',
    };
    expect(() => scenarioSpecSchema.parse(invalid)).toThrow();
  });

  it('rejects an invalid scenario id slug', () => {
    const invalid = {
      ...validScenario,
      id: 'Retry Storm With Spaces',
    };
    expect(() => scenarioSpecSchema.parse(invalid)).toThrow();
  });
});
