import { describe, expect, it } from 'vitest';
import { generateMarkdownReport, generateReportExport } from '../domain/report-generator';
import { runIdSchema, topologyIdSchema, nodeIdSchema, type RunRecord } from '@chaosboard/contracts';

describe('report-generator domain', () => {
  const dummyRunId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');
  const dummyTopoId = topologyIdSchema.parse('simple-topo');
  const dummyNodeId = nodeIdSchema.parse('node-a');

  const sampleRun: RunRecord = {
    id: dummyRunId,
    status: 'completed',
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
    baselineAggregate: null,
    faultedAggregate: null,
    verdicts: [],
    overallStatus: 'PASS',
    provenance: {
      gitCommit: 'abc1234',
      hostDescription: 'Test Host',
      nodeVersion: 'v22.13.0',
      toxiproxyVersion: '2.13.0',
      startedAt: '2026-10-30T00:00:00.000Z',
    },
    createdAt: '2026-10-30T00:00:00.000Z',
    finishedAt: '2026-10-30T00:00:05.000Z',
    errorMessage: null,
  };

  it('generates a deterministic markdown report from run record', () => {
    const md = generateMarkdownReport({
      runRecord: sampleRun,
      generatedAt: '2026-10-30T12:00:00.000Z',
    });
    expect(md).toContain(
      '# EchmaMeet Experiment Report: run-12345678-1234-1234-1234-123456789abc',
    );
    expect(md).toContain('Simple Topo');
    expect(md).toContain('`abc1234`');
  });

  it('generates an identical report twice from the same record (deterministic)', () => {
    const md1 = generateMarkdownReport({
      runRecord: sampleRun,
      generatedAt: '2026-10-30T12:00:00.000Z',
    });
    const md2 = generateMarkdownReport({
      runRecord: sampleRun,
      generatedAt: '2026-10-30T12:00:00.000Z',
    });
    expect(md1).toBe(md2);
  });

  it('generates a valid structured report export', () => {
    const exportData = generateReportExport({
      runRecord: sampleRun,
      generatedAt: '2026-10-30T12:00:00.000Z',
    });
    expect(exportData.runId).toBe(sampleRun.id);
    expect(exportData.markdown).toContain('run-12345678-1234-1234-1234-123456789abc');
  });
});
