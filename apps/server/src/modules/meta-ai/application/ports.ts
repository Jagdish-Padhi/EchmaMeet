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

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the arguments object. */
  readonly parameters: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

export type AgentMessage =
  | { readonly role: 'system' | 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly tool_calls?:
        | readonly {
            readonly id: string;
            readonly type: 'function';
            readonly function: { readonly name: string; readonly arguments: string };
          }[]
        | undefined;
    }
  | { readonly role: 'tool'; readonly tool_call_id: string; readonly content: string };

export interface ToolChatOptions {
  readonly messages: readonly AgentMessage[];
  readonly tools: readonly ToolDefinition[];
  readonly toolChoice?: 'auto' | 'required' | undefined;
  readonly temperature?: number | undefined;
  readonly maxTokens?: number | undefined;
  readonly promptVersion?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ToolChatResult {
  readonly content: string | null;
  readonly toolCalls: readonly ToolCall[];
  readonly metadata: ModelCallMetadata;
}

/** A model that can take part in a tool-calling loop. */
export interface ToolCapableModelPort {
  chatWithTools(options: ToolChatOptions): Promise<ToolChatResult>;
}
