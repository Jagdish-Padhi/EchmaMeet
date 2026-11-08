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
