import { normalizeTopologyDraft } from '../../topology';
import { describe, expect, it } from 'vitest';
import { VisionService } from '../application/vision-service';
import type { ImageDecoderPort } from '../application/ports';

describe('VisionService application', () => {
  const fakeDecoder: ImageDecoderPort = {
    inspectHeader: () => ({ width: 800, height: 600, format: 'png' }),
    decodePixels: () => ({
      width: 10,
      height: 10,
      channels: 3,
      data: new Uint8Array(300),
    }),
  };

  const service = new VisionService({
    imageDecoder: fakeDecoder,
    normalizeTopologyDraft,
  });

  it('throws vision_model_not_configured when vision model is not provided', async () => {
    const fakeBase64 = Buffer.from('fake-image-bytes-header-89PNG').toString('base64');
    await expect(service.extractDraft({ imageBase64: fakeBase64 })).rejects.toThrow(
      /Vision extraction requires an active vision model provider/,
    );
  });

  it('extracts draft via vision model when provided', async () => {
    const mockModelService = new VisionService({
      imageDecoder: fakeDecoder,
      normalizeTopologyDraft,
      visionModel: {
        extractTopologyFromImage: async () => ({
          data: {
            nodes: [
              { id: 'web-gateway', label: 'Web Gateway', kind: 'service', confidence: 0.95 },
              { id: 'auth-service', label: 'Auth Service', kind: 'service', confidence: 0.9 },
            ],
            edges: [
              { id: 'e1', sourceLabel: 'Web Gateway', targetLabel: 'Auth Service', confidence: 0.88 },
            ],
            ambiguities: [],
            warnings: [],
          },
          rawOutput: '{}',
          metadata: {
            provider: 'meta_vision',
            modelId: 'llama-3.2-11b-vision',
            promptVersion: 'v1',
            latencyMs: 120,
          },
        }),
      },
    });

    const fakeBase64 = Buffer.from('fake-image-bytes-header-89PNG').toString('base64');
    const extraction = await mockModelService.extractDraft({ imageBase64: fakeBase64 });

    expect(extraction.nodes).toHaveLength(2);
    expect(extraction.edges).toHaveLength(1);
    expect(extraction.nodes[0]?.label).toBe('Web Gateway');
  });

  it('confirms draft through topology normalization', () => {
    const topology = service.confirmDraft({
      name: 'Confirmed System',
      source: 'image',
      nodes: [
        { ref: 'gateway', label: 'API Gateway', kind: 'service' },
        { ref: 'service-a', label: 'Service A', kind: 'service' },
      ],
      edges: [{ sourceRef: 'gateway', targetRef: 'service-a' }],
    });

    expect(topology.nodes).toHaveLength(2);
    expect(topology.edges).toHaveLength(1);
    const firstEdge = topology.edges[0];
    expect(firstEdge).toBeDefined();
    if (firstEdge) {
      expect(firstEdge.source).toBe('api-gateway');
    }
  });

  it('detects single edge intersection gesture and proposes fault', async () => {
    const result = await service.detectGesture({
      strokePolyline: [
        [0.4, 0.2],
        [0.4, 0.6],
      ],
      candidateEdges: [
        {
          id: 'edge-1',
          source: 'gateway',
          target: 'service-a',
          polyline: [
            [0.2, 0.4],
            [0.6, 0.4],
          ],
        },
        {
          id: 'edge-2',
          source: 'service-a',
          target: 'database',
          polyline: [
            [0.7, 0.1],
            [0.9, 0.1],
          ],
        },
      ],
    });

    expect(result.selection.status).toBe('selected');
    if (result.selection.status === 'selected') {
      expect(result.selection.edgeId).toBe('edge-1');
      expect(result.selection.proposedFault.type).toBe('latency');
    }
  });

  it('detects ambiguous gesture when multiple edges are intersected', async () => {
    const result = await service.detectGesture({
      strokePolyline: [
        [0.1, 0.1],
        [0.9, 0.9],
      ],
      candidateEdges: [
        {
          id: 'edge-1',
          source: 'gateway',
          target: 'service-a',
          polyline: [
            [0.1, 0.5],
            [0.5, 0.1],
          ],
        },
        {
          id: 'edge-2',
          source: 'service-a',
          target: 'database',
          polyline: [
            [0.5, 0.9],
            [0.9, 0.5],
          ],
        },
      ],
    });

    expect(result.selection.status).toBe('ambiguous');
    if (result.selection.status === 'ambiguous') {
      expect(result.selection.candidates).toContain('edge-1');
      expect(result.selection.candidates).toContain('edge-2');
    }
  });
});
