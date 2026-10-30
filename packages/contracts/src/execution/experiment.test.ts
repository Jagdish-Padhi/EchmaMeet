import { describe, it, expect } from 'vitest';
import { startExperimentRequestSchema, startExperimentResponseSchema } from './experiment';
import { runIdSchema } from '../common/ids';

describe('experiment contract', () => {
  it('accepts valid start experiment request and response', () => {
    const req = startExperimentRequestSchema.parse({
      topology: {
        schemaVersion: 1,
        id: 'simple-topo',
        name: 'Simple Topo',
        source: 'scenario',
        entry: { nodeId: 'node-a' },
        nodes: [
          {
            id: 'node-a',
            label: 'Node A',
            kind: 'service',
            processing: { distribution: 'constant', ms: 10 },
            concurrency: { maxWorkers: 5 },
            queue: { mode: 'bounded', maxDepth: 10 },
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
        warmupMs: 100,
        measurementMs: 1000,
        cooldownMs: 100,
        clientTimeoutMs: 1000,
        seed: 12345,
        trials: 2,
      },
    });
    expect(req.topology.id).toBe('simple-topo');

    const res = startExperimentResponseSchema.parse({
      runId: runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc'),
    });
    expect(res.runId).toContain('run-');
  });

  it('rejects invalid trial config in experiment request', () => {
    expect(() =>
      startExperimentRequestSchema.parse({
        topology: {
          schemaVersion: 1,
          id: 'simple-topo',
          name: 'Simple Topo',
          source: 'scenario',
          entry: { nodeId: 'node-a' },
          nodes: [],
          edges: [],
        },
        faults: [],
        invariants: [],
        trialConfig: {
          arrivalRateRps: -5, // invalid
          arrivalProcess: 'constant',
          warmupMs: 100,
          measurementMs: 1000,
          cooldownMs: 100,
          clientTimeoutMs: 1000,
          seed: 12345,
          trials: 2,
        },
      }),
    ).toThrow();
  });
});
