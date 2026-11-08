import type { CandidateEdge, TopologyProblem, VisionExtraction } from '@chaosboard/contracts';
import type { Result } from '@chaosboard/shared';
import type { NormalizedTopology } from '../../topology';
import type { RawImageData } from '../domain/color-threshold';

export interface ImageDecoderPort {
  inspectHeader(buffer: Buffer): { width: number; height: number; format: 'png' | 'jpeg' };
  decodePixels(buffer: Buffer): RawImageData;
}

export interface VisionServicePorts {
  readonly imageDecoder: ImageDecoderPort;
  readonly normalizeTopologyDraft: (
    input: unknown,
  ) => Result<NormalizedTopology, TopologyProblem[]>;
  readonly visionModel?:
    | {
        extractTopologyFromImage(
          imageBase64: string,
          mimeType: string,
          options?: { signal?: AbortSignal },
        ): Promise<{ data: VisionExtraction }>;
      }
    | undefined;
}

export interface ExtractDraftRequest {
  readonly imageBase64: string;
  readonly mimeType?: string | undefined;
}

export interface GestureDetectionRequest {
  readonly strokePolyline?: readonly [number, number][] | undefined;
  readonly imageKeyframe?: string | undefined;
  readonly candidateEdges: readonly CandidateEdge[];
}
