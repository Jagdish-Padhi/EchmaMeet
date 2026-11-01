import { visionExtractionSchema, type VisionExtraction } from '@chaosboard/contracts';
import type { StructuredModelResult, VisionModelPort } from '../application/ports';
import { ModelCallError } from '../domain/errors';

export interface VisionAdapterConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly modelId?: string | undefined;
  readonly defaultTimeoutMs?: number | undefined;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = jsonBlockRegex.exec(trimmed);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

export class OpenAiVisionAdapter implements VisionModelPort {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly defaultTimeoutMs: number;

  constructor(config: VisionAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    if (config.modelId) {
      this.modelId = config.modelId;
    } else if (this.baseUrl.includes('groq.com')) {
      this.modelId = 'llama-3.2-11b-vision-preview';
    } else if (this.baseUrl.includes('openai.com')) {
      this.modelId = 'gpt-4o-mini';
    } else {
      this.modelId = 'meta-models/llama-3.2-11b-vision';
    }
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 60_000;
  }

  async extractTopologyFromImage(
    imageBase64: string,
    mimeType: string,
    options?: { signal?: AbortSignal },
  ): Promise<StructuredModelResult<VisionExtraction>> {
    const prompt = `You are an expert distributed systems architect.
Examine this architecture diagram image and extract all system components (nodes) and their directed network connections (edges).

Output ONLY a JSON object strictly matching this format:
{
  "nodes": [
    {
      "id": "lowercase-kebab-name",
      "label": "Component Label",
      "kind": "service",
      "confidence": 0.95,
      "box": { "x": 0.1, "y": 0.2, "width": 0.2, "height": 0.1 }
    }
  ],
  "edges": [
    {
      "id": "edge-source-target",
      "sourceLabel": "Source Component Label",
      "targetLabel": "Target Component Label",
      "confidence": 0.9
    }
  ],
  "ambiguities": ["Any text or connection that was unclear"],
  "warnings": []
}

Allowed node kind values are strictly: "service", "cache", "queue_consumer", "ledger_sink".
If no recognizable software architecture nodes exist, return empty nodes: [] and edges: [] and explain in warnings.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
    const onAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onAbort);

    const startNs = process.hrtime.bigint();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      const elapsedMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1e6);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ModelCallError(
          'transport_error',
          `Vision model HTTP ${response.status}: ${body}`,
        );
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new ModelCallError('refusal', 'Vision model returned empty response.');
      }

      const parsed: unknown = JSON.parse(extractJsonText(content));
      const validated = visionExtractionSchema.parse(parsed);

      return {
        data: validated,
        rawOutput: content,
        metadata: {
          provider: 'meta_vision',
          modelId: this.modelId,
          promptVersion: 'v1',
          latencyMs: elapsedMs,
        },
      };
    } catch (err) {
      if (err instanceof ModelCallError) throw err;
      throw new ModelCallError(
        'transport_error',
        `Vision model extraction error: ${(err as Error).message}`,
        err,
      );
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', onAbort);
    }
  }
}
