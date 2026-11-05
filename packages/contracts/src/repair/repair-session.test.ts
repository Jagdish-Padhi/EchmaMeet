import { describe, it, expect } from 'vitest';
import {
  startRepairRequestSchema,
  startRepairResponseSchema,
  repairSessionRecordSchema,
} from './repair-session';
import { topologySchema, type Topology } from '../topology/topology';

describe('Repair session contract schemas', () => {
  const dummyTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'topo-rep',
    name: 'Repair Topo',
    source: 'scenario',
    entry: { nodeId: 'entry' },
    nodes: [
      {
        id: 'entry',
        label: 'Entry',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 100 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [],
  });

  it('parses valid start repair request', () => {
    const req = {
      topology: dummyTopology,
      faults: [],
      invariants: [],
      trialConfig: {
        arrivalRateRps: 10,
        arrivalProcess: 'constant',
        warmupMs: 200,
        measurementMs: 1000,
        cooldownMs: 100,
        clientTimeoutMs: 1000,
        seed: 42,
        trials: 2,
      },
    };

    const parsed = startRepairRequestSchema.parse(req);
    expect(parsed.proposer).toBe('model');
    expect(parsed.maxIterations).toBe(5);
  });

  it('parses start repair response', () => {
    const res = startRepairResponseSchema.parse({
      repairId: 'run-12345678',
      status: 'running',
    });
    expect(res.repairId).toBe('run-12345678');
  });

  it('parses repair session record', () => {
    const record = {
      id: 'run-12345678',
      status: 'repaired',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      proposer: 'rule_based',
      initialTopology: dummyTopology,
      bestTopology: dummyTopology,
      faults: [],
      invariants: [],
      trialConfig: {
        arrivalRateRps: 10,
        arrivalProcess: 'constant',
        warmupMs: 200,
        measurementMs: 1000,
        cooldownMs: 100,
        clientTimeoutMs: 1000,
        seed: 42,
        trials: 2,
      },
      iterations: [],
      finalReport: null,
      errorMessage: null,
    };

    const parsed = repairSessionRecordSchema.parse(record);
    expect(parsed.status).toBe('repaired');
  });
});
