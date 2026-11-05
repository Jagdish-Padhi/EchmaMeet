import { describe, expect, it } from 'vitest';
import { ReportingService } from '../application/reporting-service';
import type { RunReaderPort, ImageGenerationPort } from '../application/ports';
import { runIdSchema, topologyIdSchema, nodeIdSchema, type RunRecord } from '@chaosboard/contracts';

describe('ReportingService', () => {
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

  const mockReader: RunReaderPort = {
    getRunRecord: (runId) => Promise.resolve(runId === sampleRun.id ? sampleRun : null),
  };

  it('retrieves markdown report for valid run', async () => {
    const service = new ReportingService(mockReader);
    const md = await service.getMarkdownReport(sampleRun.id);
    expect(md).toContain(sampleRun.id);
  });

  it('throws for non-existent run', async () => {
    const service = new ReportingService(mockReader);
    await expect(
      service.getMarkdownReport('run-99999999-9999-9999-9999-999999999999'),
    ).rejects.toThrow('Run not found');
  });

  it('retrieves diagram SVG', async () => {
    const service = new ReportingService(mockReader);
    const svg = await service.getDiagramSvg(sampleRun.id);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Node A');
  });

  it('falls back to deterministic diagram if image generator is unavailable', async () => {
    const mockImageGen: ImageGenerationPort = {
      isAvailable: () => false,
      generateBlueprintCard: () => Promise.resolve(null),
    };
    const service = new ReportingService(mockReader, mockImageGen);
    const card = await service.getBlueprintCard(sampleRun.id);

    expect(card.status).toBe('fallback_to_diagram');
    expect(card.label).toBe('illustrative_rendering');
    expect(card.mimeType).toBe('image/svg+xml');
    expect(card.content).toContain('<svg');
  });

  it('returns generated card when image generator succeeds', async () => {
    const mockImageGen: ImageGenerationPort = {
      isAvailable: () => true,
      generateBlueprintCard: () =>
        Promise.resolve({
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
          mimeType: 'image/png',
        }),
    };
    const service = new ReportingService(mockReader, mockImageGen);
    const card = await service.getBlueprintCard(sampleRun.id);

    expect(card.status).toBe('generated');
    expect(card.mimeType).toBe('image/png');
    expect(card.content).toContain('base64');
  });
});
