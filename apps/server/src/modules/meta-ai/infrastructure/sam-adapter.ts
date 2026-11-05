import type { SamMaskItem, SamSegmentationPort, SamSegmentationResult } from '../application/ports';
import { ModelCallError } from '../domain/errors';

export interface SamAdapterConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly modelId?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  /** Image MIME type used in the data URL (the vision service passes PNG or JPEG). */
  readonly defaultMimeType?: string | undefined;
}

export const SAM_MODEL_ID = 'sam-3.1';

/**
 * Parses the special-token text SAM 3.1 returns through the Responses API. One line per frame:
 *   <Nf>id<|box;x1=..;y1=..;x2=..;y2=..;w=<frameW>;h=<frameH>|><|mask;...|>,id<|box;...|>...
 * Only boxes are consumed here; box coordinates are normalised to 0..1 using the frame size
 * carried in each record. Malformed records are skipped, never guessed.
 */
export function parseSamTokenText(text: string, label: string): SamMaskItem[] {
  const items: SamMaskItem[] = [];
  const boxPattern = /<\|box;([^|]*)\|>/g;
  for (const match of text.matchAll(boxPattern)) {
    const fields = new Map<string, number>();
    for (const part of (match[1] ?? '').split(';')) {
      const [key, value] = part.split('=');
      const parsed = Number(value);
      if (key && value !== undefined && Number.isFinite(parsed)) fields.set(key.trim(), parsed);
    }
    const x1 = fields.get('x1');
    const y1 = fields.get('y1');
    const x2 = fields.get('x2');
    const y2 = fields.get('y2');
    const w = fields.get('w');
    const h = fields.get('h');
    if (
      x1 === undefined ||
      y1 === undefined ||
      x2 === undefined ||
      y2 === undefined ||
      !w ||
      !h ||
      w <= 0 ||
      h <= 0
    ) {
      continue;
    }
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    items.push({
      label,
      // SAM token output carries no confidence; presence of the record is the detection.
      score: 1,
      box: [clamp(x1 / w), clamp(y1 / h), clamp(x2 / w), clamp(y2 / h)],
    });
  }
  return items;
}

function collectOutputText(json: unknown): string {
  if (typeof json !== 'object' || json === null) return '';
  const record = json as Record<string, unknown>;
  if (typeof record['output_text'] === 'string') return record['output_text'];
  const chunks: string[] = [];
  const output = record['output'];
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as Record<string, unknown> | null)?.['content'];
      if (Array.isArray(content)) {
        for (const part of content) {
          const text = (part as Record<string, unknown> | null)?.['text'];
          if (typeof text === 'string') chunks.push(text);
        }
      }
    }
  }
  return chunks.join('\n');
}

/** SAM 3.1 through the Meta Model API Responses endpoint (`model: sam-3.1`). */
export class SamSegmentationAdapter implements SamSegmentationPort {
  private readonly modelId: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly config: SamAdapterConfig) {
    this.modelId = config.modelId ?? SAM_MODEL_ID;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = `${config.baseUrl.replace(/\/$/, '')}/responses`;
  }

  async segmentKeyframe(
    imageBase64: string,
    prompt: string,
    options?: { signal?: AbortSignal },
  ): Promise<SamSegmentationResult> {
    const mime = this.config.defaultMimeType ?? 'image/png';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onAbort);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: prompt },
                { type: 'input_image', image_url: `data:${mime};base64,${imageBase64}` },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ModelCallError(
          res.status === 429 || res.status >= 500 ? 'transport_error' : 'malformed_output',
          `SAM 3.1 HTTP ${String(res.status)}: ${body.slice(0, 300)}`,
        );
      }
      const text = collectOutputText(await res.json());
      return { masks: parseSamTokenText(text, prompt) };
    } catch (err) {
      if (err instanceof ModelCallError) throw err;
      if (controller.signal.aborted) {
        throw new ModelCallError('timeout', `SAM 3.1 exceeded ${String(this.timeoutMs)}ms`);
      }
      throw new ModelCallError(
        'transport_error',
        `SAM 3.1 unreachable: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', onAbort);
    }
  }
}
