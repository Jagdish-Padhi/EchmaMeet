import { describe, expect, it } from 'vitest';
import { visionConfirmRequestSchema, visionExtractionSchema } from './vision-draft';

describe('visionDraftSchema', () => {
  it('validates a complete vision extraction fixture', () => {
    const valid = {
      nodes: [
        {
          id: 'n1',
          label: 'Gateway',
          kind: 'service' as const,
          confidence: 0.95,
          box: { x: 0.1, y: 0.2, width: 0.2, height: 0.15 },
        },
        {
          id: 'n2',
          label: 'Service A',
          kind: 'service' as const,
          confidence: 0.88,
          box: { x: 0.5, y: 0.2, width: 0.2, height: 0.15 },
        },
      ],
      edges: [
        {
          id: 'e1',
          sourceLabel: 'Gateway',
          targetLabel: 'Service A',
          confidence: 0.9,
          polyline: [
            [0.3, 0.27],
            [0.5, 0.27],
          ],
        },
      ],
      ambiguities: ['Node n2 kind inferred from box label'],
      warnings: [],
    };
    expect(() => visionExtractionSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid node confidence or box out of bounds', () => {
    const invalid = {
      nodes: [
        {
          id: 'n1',
          label: 'Gateway',
          confidence: 1.5, // > 1.0
        },
      ],
      edges: [],
      ambiguities: [],
      warnings: [],
    };
    expect(() => visionExtractionSchema.parse(invalid)).toThrow();
  });

  it('validates a vision confirmation request with source image', () => {
    const valid = {
      draft: {
        name: 'Confirmed Photo Topology',
        source: 'image' as const,
        nodes: [{ ref: 'gw', label: 'Gateway' }],
        edges: [],
      },
    };
    expect(() => visionConfirmRequestSchema.parse(valid)).not.toThrow();

    const invalid = {
      draft: {
        name: 'Invalid Canvas Draft',
        source: 'canvas' as const, // must be 'image'
        nodes: [{ ref: 'gw', label: 'Gateway' }],
        edges: [],
      },
    };
    expect(() => visionConfirmRequestSchema.parse(invalid)).toThrow();
  });
});
