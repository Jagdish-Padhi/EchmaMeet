import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportViewer } from '../components/ReportViewer';
import type { ApiClient } from '../../../api/client';
import { runIdSchema } from '@chaosboard/contracts';

describe('ReportViewer component', () => {
  const dummyRunId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');

  const mockApi = {
    getReportJson: () =>
      Promise.resolve({
        runId: dummyRunId,
        status: 'completed' as const,
        generatedAt: '2026-10-30T12:00:00.000Z',
        provenance: {
          gitCommit: 'abc1234',
          hostDescription: 'Test Host',
          nodeVersion: 'v22.13.0',
          toxiproxyVersion: '2.13.0',
          startedAt: '2026-10-30T12:00:00.000Z',
        },
        topology: {
          schemaVersion: 1 as const,
          id: 'simple-topo',
          name: 'Simple Topo',
          source: 'scenario' as const,
          entry: { nodeId: 'node-a' },
          nodes: [],
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
        markdown: '# Test Report',
        diagramSvg: '<svg><text>Topology Diagram</text></svg>',
      }),
    getBlueprintCard: () =>
      Promise.resolve({
        runId: dummyRunId,
        status: 'fallback_to_diagram' as const,
        label: 'illustrative_rendering' as const,
        mimeType: 'image/svg+xml',
        content: '<svg></svg>',
        promptSummary: 'Topology with 1 node',
        authoritativeMetrics: {
          p50Ms: 120,
          p99Ms: 340,
          errorRate: 0.05,
        },
        fallbackReason: 'Deterministic vector diagram generated',
      }),
  } as unknown as ApiClient;

  it('renders initial loading state', () => {
    const html = renderToStaticMarkup(<ReportViewer api={mockApi} runId={dummyRunId} />);
    expect(html).toContain('Run Report &amp; Artifact Export');
    expect(html).toContain('Loading report data');
  });
});
