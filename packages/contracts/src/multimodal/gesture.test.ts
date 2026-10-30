import { describe, expect, it } from 'vitest';
import { redStrokeDetectionResultSchema, redStrokeGestureRequestSchema } from './gesture';

describe('redStrokeGesture contracts', () => {
  it('validates a gesture request with polyline and candidates', () => {
    const valid = {
      strokePolyline: [
        [0.35, 0.2],
        [0.35, 0.35],
      ],
      candidateEdges: [
        {
          id: 'e1',
          source: 'gateway',
          target: 'service-a',
          polyline: [
            [0.3, 0.27],
            [0.5, 0.27],
          ],
        },
      ],
    };
    expect(() => redStrokeGestureRequestSchema.parse(valid)).not.toThrow();
  });

  it('validates detection result with selected fault', () => {
    const selected = {
      detector: 'color_threshold' as const,
      strokePolyline: [[0.35, 0.2] as [number, number], [0.35, 0.35] as [number, number]],
      intersections: [
        {
          edgeId: 'e1',
          source: 'gateway',
          target: 'service-a',
          point: [0.35, 0.27] as [number, number],
        },
      ],
      selection: {
        status: 'selected' as const,
        edgeId: 'e1',
        source: 'gateway',
        target: 'service-a',
        proposedFault: {
          id: 'fault-1',
          edgeId: 'e1',
          type: 'latency' as const,
          toxicity: 1,
          direction: 'downstream' as const,
          startOffsetMs: 0,
          latencyMs: 300,
          jitterMs: 50,
        },
      },
    };
    expect(() => redStrokeDetectionResultSchema.parse(selected)).not.toThrow();
  });

  it('validates detection result with ambiguous or none status', () => {
    const ambiguous = {
      detector: 'sam' as const,
      strokePolyline: [[0.1, 0.1] as [number, number], [0.9, 0.9] as [number, number]],
      intersections: [
        {
          edgeId: 'e1',
          source: 'a',
          target: 'b',
          point: [0.3, 0.3] as [number, number],
        },
        {
          edgeId: 'e2',
          source: 'c',
          target: 'd',
          point: [0.6, 0.6] as [number, number],
        },
      ],
      selection: {
        status: 'ambiguous' as const,
        candidates: ['e1', 'e2'],
        message: 'Multiple edge intersections found. Please select intended edge.',
      },
    };
    expect(() => redStrokeDetectionResultSchema.parse(ambiguous)).not.toThrow();
  });
});
