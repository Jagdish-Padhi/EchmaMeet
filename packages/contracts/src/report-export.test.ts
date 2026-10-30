import { describe, expect, it } from 'vitest';
import { reportExportSchema, blueprintCardSchema } from './report-export';
import type { ReportExport, BlueprintCard } from './report-export';
import { runIdSchema, topologyIdSchema, nodeIdSchema } from './ids';

describe('report-export contracts', () => {
  const dummyRunId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');
  const dummyTopoId = topologyIdSchema.parse('simple-topo');
  const dummyNodeId = nodeIdSchema.parse('node-a');

  const validReport: ReportExport = {
    runId: dummyRunId,
    status: 'completed',
    generatedAt: '2026-10-30T12:00:00.000Z',
    provenance: {
      gitCommit: 'abc1234',
      hostDescription: 'Test Host',
      nodeVersion: 'v22.13.0',
      toxiproxyVersion: '2.13.0',
      startedAt: '2026-10-30T00:00:00.000Z',
    },
    topology: {
      schemaVersion: 1,
      id: dummyTopoId,
      name: 'Simple Topo',
      source: 'scenario',
      entry: { nodeId: dummyNodeId },
      nodes: [
        {
          id: dummyNodeId,
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
    baselineMetrics: null,
    faultedMetrics: null,
    repairedMetrics: null,
    verdicts: [],
    repairTimeline: [],
    tradeOffReport: null,
    markdown: '# ChaosBoard Run Report\n\nRun ID: run-12345678-1234-1234-1234-123456789abc',
    diagramSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"></svg>',
  };

  it('validates a complete report export record', () => {
    const parsed = reportExportSchema.parse(validReport);
    expect(parsed.runId).toBe(validReport.runId);
    expect(parsed.status).toBe('completed');
  });

  it('rejects an invalid report with missing required fields', () => {
    expect(() =>
      reportExportSchema.parse({
        runId: 'invalid-uuid',
      }),
    ).toThrow();
  });

  it('validates a blueprint card record', () => {
    const card: BlueprintCard = {
      runId: dummyRunId,
      status: 'fallback_to_diagram',
      label: 'illustrative_rendering',
      mimeType: 'image/svg+xml',
      content: '<svg></svg>',
      promptSummary: 'Topology with 1 node',
      authoritativeMetrics: {
        p50Ms: 350,
        p99Ms: 450,
        errorRate: 0.25,
      },
      fallbackReason: 'Deterministic vector diagram generated',
    };

    const parsed = blueprintCardSchema.parse(card);
    expect(parsed.status).toBe('fallback_to_diagram');
    expect(parsed.label).toBe('illustrative_rendering');
  });
});
