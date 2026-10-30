import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisionDraftOverlay } from '../components/VisionDraftOverlay';
import { GestureResultBanner } from '../components/GestureResultBanner';
import {
  type VisionExtraction,
  type RedStrokeDetectionResult,
  faultIdSchema,
  edgeIdSchema,
} from '@chaosboard/contracts';

describe('Vision Feature components', () => {
  it('renders vision draft overlay with node boxes and ambiguities', () => {
    const fixture: VisionExtraction = {
      nodes: [
        {
          id: 'n1',
          label: 'Gateway',
          kind: 'service',
          confidence: 0.95,
          box: { x: 0.1, y: 0.2, width: 0.2, height: 0.15 },
        },
      ],
      edges: [
        {
          id: 'e1',
          sourceLabel: 'Gateway',
          targetLabel: 'Database',
          confidence: 0.9,
          polyline: [
            [0.3, 0.27],
            [0.6, 0.27],
          ],
        },
      ],
      ambiguities: ['Unclear queue depth on database'],
      warnings: ['Deterministic fallback used'],
    };

    const html = renderToStaticMarkup(
      <VisionDraftOverlay
        previewUrl="data:image/png;base64,fake"
        extraction={fixture}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(html).toContain('Gateway');
    expect(html).toContain('Unclear queue depth on database');
    expect(html).toContain('Deterministic fallback used');
    expect(html).toContain('Confirm &amp; Load into Canvas');
  });

  it('renders gesture result banner with selected edge and detector badge', () => {
    const result: RedStrokeDetectionResult = {
      detector: 'color_threshold',
      strokePolyline: [
        [0.4, 0.1],
        [0.4, 0.5],
      ],
      intersections: [
        {
          edgeId: 'edge-1',
          source: 'gateway',
          target: 'backend',
          point: [0.4, 0.3],
        },
      ],
      selection: {
        status: 'selected',
        edgeId: 'edge-1',
        source: 'gateway',
        target: 'backend',
        proposedFault: {
          id: faultIdSchema.parse('f1'),
          edgeId: edgeIdSchema.parse('edge-1'),
          type: 'latency',
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          latencyMs: 300,
          jitterMs: 50,
        },
      },
    };

    const html = renderToStaticMarkup(<GestureResultBanner result={result} />);
    expect(html).toContain('Detector: Color Threshold');
    expect(html).toContain('gateway -&gt; backend');
    expect(html).toContain('300ms latency');
  });
});
