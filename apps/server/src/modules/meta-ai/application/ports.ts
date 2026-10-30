import type { VisionExtraction } from '@chaosboard/contracts';
import type { z } from 'zod';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ModelCallMetadata {
  readonly provider: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly latencyMs: number;
  readonly tokenCounts?:
    | {
        readonly promptTokens?: number | undefined;
        readonly completionTokens?: number | undefined;
      }
    | undefined;
}

export interface StructuredModelCallOptions<T> {
  readonly messages: readonly ChatMessage[];
  readonly responseSchema: z.ZodType<T>;
  readonly promptVersion?: string | undefined;
  readonly temperature?: number | undefined;
  readonly maxTokens?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface StructuredModelResult<T> {
  readonly data: T;
  readonly rawOutput: string;
  readonly metadata: ModelCallMetadata;
}

export interface StructuredModelPort {
  generateStructured<T>(options: StructuredModelCallOptions<T>): Promise<StructuredModelResult<T>>;
}

export interface VisionModelPort {
  extractTopologyFromImage(
    imageBase64: string,
    mimeType: string,
    options?: { signal?: AbortSignal },
  ): Promise<StructuredModelResult<VisionExtraction>>;
}

export interface SamMaskItem {
  readonly label: string;
  readonly score: number;
  readonly box: readonly [number, number, number, number]; // [x1, y1, x2, y2]
  readonly points?: readonly (readonly [number, number])[] | undefined;
}

export interface SamSegmentationResult {
  readonly masks: readonly SamMaskItem[];
}

export interface SamSegmentationPort {
  segmentKeyframe(
    imageBase64: string,
    prompt: string,
    options?: { signal?: AbortSignal },
  ): Promise<SamSegmentationResult>;
}
