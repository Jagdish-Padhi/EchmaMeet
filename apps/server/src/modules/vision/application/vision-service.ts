import {
  edgeIdSchema,
  faultIdSchema,
  type Fault,
  type RedStrokeDetectionResult,
  type RedStrokeIntersection,
  type RedStrokePoint,
  type Topology,
  type TopologyDraft,
  type VisionExtraction,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import { detectRedStrokePixels } from '../domain/color-threshold';
import { findPolylineIntersections } from '../domain/geometry';
import { parseSamSegmentation } from '../domain/sam-parser';
import type { ExtractDraftRequest, GestureDetectionRequest, VisionServicePorts } from './ports';

export class VisionService {
  constructor(private readonly ports: VisionServicePorts) {}

  async extractDraft(request: ExtractDraftRequest): Promise<VisionExtraction> {
    if (!request.imageBase64 || request.imageBase64.trim().length === 0) {
      throw new AppError('validation', 'missing_image', 'Image payload is empty.');
    }

    const buffer = Buffer.from(request.imageBase64, 'base64');
    const header = this.ports.imageDecoder.inspectHeader(buffer);
    const mimeType = request.mimeType ?? `image/${header.format}`;

    if (!this.ports.visionModel) {
      throw new AppError(
        'unavailable',
        'vision_model_not_configured',
        'Vision extraction requires an active vision model provider (e.g. Meta Llama 3.2 Vision). Please configure PARTNER_API_KEY.',
      );
    }

    try {
      const result = await this.ports.visionModel.extractTopologyFromImage(
        request.imageBase64,
        mimeType,
      );
      this.validateDraftThroughTopology(result.data);
      return result.data;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        'internal',
        'vision_extraction_failed',
        `Vision extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  confirmDraft(draft: TopologyDraft): Topology {
    if (draft.source !== 'image') {
      throw new AppError(
        'validation',
        'invalid_draft_source',
        "Confirmed vision draft must have source: 'image'",
      );
    }
    // Normalization through the topology public API
    const result = this.ports.normalizeTopologyDraft(draft);
    if (!result.ok) {
      throw new AppError(
        'validation',
        'invalid_draft_topology',
        `Draft normalization failed: ${result.error.map((p) => p.message).join('; ')}`,
      );
    }
    return result.value.topology;
  }

  async detectGesture(request: GestureDetectionRequest): Promise<RedStrokeDetectionResult> {
    let detector: 'sam' | 'color_threshold' = 'color_threshold';
    let strokePolyline: RedStrokePoint[] = [];

    // 1. If explicit stroke points are provided
    if (request.strokePolyline && request.strokePolyline.length >= 2) {
      strokePolyline = [...request.strokePolyline];
    } else if (request.imageKeyframe) {
      // 2. Try SAM 3.1 if configured
      if (this.ports.samModel) {
        try {
          const samRes = await this.ports.samModel.segmentKeyframe(
            request.imageKeyframe,
            'red marker stroke line',
          );
          const parsed = parseSamSegmentation(samRes);
          if (parsed.strokePolyline && parsed.strokePolyline.length >= 2) {
            detector = 'sam';
            strokePolyline = [...parsed.strokePolyline];
          }
        } catch {
          // Fall through to deterministic color-threshold detector
        }
      }

      // 3. Deterministic color-threshold fallback
      if (strokePolyline.length < 2) {
        const buffer = Buffer.from(request.imageKeyframe, 'base64');
        const pixels = this.ports.imageDecoder.decodePixels(buffer);
        strokePolyline = detectRedStrokePixels(pixels);
        detector = 'color_threshold';
      }
    }

    if (strokePolyline.length < 2) {
      return {
        detector,
        strokePolyline: [],
        intersections: [],
        selection: {
          status: 'none',
          message: 'No red stroke detected in image.',
        },
      };
    }

    // Intersect stroke with candidate edge polylines
    const intersections: RedStrokeIntersection[] = [];

    for (const edge of request.candidateEdges) {
      const points = findPolylineIntersections(strokePolyline, edge.polyline);
      for (const pt of points) {
        intersections.push({
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          point: pt,
        });
      }
    }

    // Determine selection outcome
    const uniqueIntersectedEdgeIds = Array.from(new Set(intersections.map((i) => i.edgeId)));

    if (uniqueIntersectedEdgeIds.length === 1) {
      const edgeId = uniqueIntersectedEdgeIds[0];
      if (edgeId) {
        const match = request.candidateEdges.find((e) => e.id === edgeId);
        const source = match ? match.source : 'source';
        const target = match ? match.target : 'target';
        const parsedEdgeId = edgeIdSchema.parse(edgeId);
        const proposedFault: Fault = {
          id: faultIdSchema.parse(`fault-${edgeId}`),
          edgeId: parsedEdgeId,
          type: 'latency',
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          latencyMs: 300,
          jitterMs: 50,
        };

        return {
          detector,
          strokePolyline,
          intersections,
          selection: {
            status: 'selected',
            edgeId,
            source,
            target,
            proposedFault,
          },
        };
      }
    }

    if (uniqueIntersectedEdgeIds.length > 1) {
      return {
        detector,
        strokePolyline,
        intersections,
        selection: {
          status: 'ambiguous',
          candidates: uniqueIntersectedEdgeIds,
          message: `Stroke intersects ${String(uniqueIntersectedEdgeIds.length)} edges (${uniqueIntersectedEdgeIds.join(', ')}). Please select intended edge.`,
        },
      };
    }

    return {
      detector,
      strokePolyline,
      intersections: [],
      selection: {
        status: 'none',
        message: 'Stroke did not cross any candidate topology edge.',
      },
    };
  }

  private validateDraftThroughTopology(extraction: VisionExtraction): void {
    const draft: TopologyDraft = {
      name: 'Extracted Vision Topology',
      source: 'image',
      nodes: extraction.nodes.map((n) => ({
        ref: n.id,
        label: n.label,
        ...(n.kind ? { kind: n.kind } : {}),
      })),
      edges: extraction.edges.map((e) => ({
        sourceRef: e.sourceLabel,
        targetRef: e.targetLabel,
      })),
    };
    // Verify that topology normalization accepts or surfaces problems
    const result = this.ports.normalizeTopologyDraft(draft);
    if (!result.ok) {
      extraction.warnings.push(
        ...result.error.map((p) => `Topology normalization issue: ${p.message}`),
      );
    }
  }
}
