import { describe, it, expect } from 'vitest';
import { tradeOffReportSchema } from './trade-off';
import { topologySchema, type Topology } from './topology';

describe('TradeOffReport contract schema', () => {
  it('parses a valid trade-off report', () => {
    const topology: Topology = topologySchema.parse({
      schemaVersion: 1,
      id: 't-1',
      name: 'Topology 1',
      source: 'scenario',
      entry: { nodeId: 'n-entry' },
      nodes: [
        {
          id: 'n-entry',
          label: 'Entry',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    });

    const report = {
      schemaVersion: 1,
      bestTopology: topology,
      iterationsTried: 3,
      satisfiedInvariants: [],
      unsatisfiedInvariants: [
        {
          invariantId: 'inv-lat',
          status: 'VIOLATED',
          reason: null,
          evidence: {
            metric: 'e2e_p99_ms',
            scope: { kind: 'system' },
            comparator: 'lte',
            threshold: 100,
            baselineAggregate: { median: 50, p25: 45, p75: 55, iqr: 10 },
            faultedAggregate: { median: 250, p25: 240, p75: 260, iqr: 20 },
            baselineValues: [50],
            faultedValues: [250],
          },
        },
      ],
      bottleneckReason:
        'Downstream service has 200ms latency toxic, making system p99 < 100ms impossible without asynchronous decoupling',
      humanRecommendations: [
        'Consider making the edge asynchronous to decouple caller from downstream latency',
        'Or relax the p99 SLA to 300ms under degraded network conditions',
      ],
    };

    const parsed = tradeOffReportSchema.parse(report);
    expect(parsed.iterationsTried).toBe(3);
    expect(parsed.unsatisfiedInvariants.length).toBe(1);
    expect(parsed.humanRecommendations.length).toBe(2);
  });
});
