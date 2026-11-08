import {
  GNANI_REST_CONTAINERS,
  mimeForContainer,
  sniffAudioContainer,
  wavDurationSeconds,
} from '../domain/audio';
import { classifyHttpFailure, GnaniError } from '../domain/errors';
import { detectLanguageFromScript, normalizeLanguageSelection } from '../domain/languages';
import type { SpeechToTextPort, TranscribeRequest, TranscribeResult } from '../application/ports';
import { withRetry } from './retry';

export interface GnaniSttConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: 'prisma-v3.0' | 'prisma-v2.5';
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly fetchImpl?: typeof fetch | undefined;
}

/** Output styles supported by Prisma v3.0. `transcribe` keeps English words Latin and numbers as digits. */
export type SttFormat = 'verbatim' | 'transcribe' | 'codemix' | 'transliterate';

const REST_MAX_SECONDS = 30;

export class GnaniSttClient implements SpeechToTextPort {
  constructor(private readonly config: GnaniSttConfig) {}

  get model(): string {
    return this.config.model;
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    if (!this.config.apiKey) {
      throw new GnaniError('not_configured', 'GNANI_API_KEY is not set.');
    }
    const container = sniffAudioContainer(request.audio);
    if (!GNANI_REST_CONTAINERS.has(container)) {
      throw new GnaniError(
        'unsupported_audio',
        `Unsupported audio container "${container}". Send wav, mp3, ogg, flac, aac or m4a (the web app encodes 16 kHz mono WAV).`,
      );
    }
    const seconds = wavDurationSeconds(request.audio);
    if (seconds !== undefined && seconds > REST_MAX_SECONDS) {
      throw new GnaniError(
        'bad_request',
        `Clip is ${seconds.toFixed(1)}s; REST transcription accepts at most ${String(REST_MAX_SECONDS)}s.`,
      );
    }

    const started = Date.now();
    const run = async (model: GnaniSttConfig['model']): Promise<TranscribeResult> => {
      const form = new FormData();
      const bytes = new Uint8Array(request.audio);
      form.append(
        'audio_file',
        new Blob([bytes], { type: mimeForContainer(container) }),
        `audio.${container}`,
      );
      form.append('model', model);
      const language = normalizeLanguageSelection(request.language);
      form.append('language_code', language);
      if (model === 'prisma-v3.0') {
        form.append('format', request.format ?? 'transcribe');
        const terms = (request.keyterms ?? []).filter((t) => t.trim() !== '').slice(0, 200);
        if (terms.length > 0) form.append('keyterms', JSON.stringify(terms));
        if (request.topic && request.topic.trim() !== '') {
          form.append('topic', request.topic.slice(0, 1600));
        }
      } else if (language !== 'indic-auto' && !language.includes(',')) {
        form.append('format', request.format === 'verbatim' ? 'verbatim' : 'transcribe');
      }

      const fetchImpl = this.config.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await fetchImpl(`${this.config.baseUrl}/stt/v3`, {
          method: 'POST',
          headers: { 'X-API-Key-ID': this.config.apiKey },
          body: form,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
      } catch (cause) {
        const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
        throw new GnaniError(timedOut ? 'timeout' : 'upstream', 'Gnani STT request failed.', {
          cause,
        });
      }
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok || (body as { success?: boolean } | undefined)?.success === false) {
        throw classifyHttpFailure(response.status, body);
      }
      const data = (body ?? {}) as Record<string, unknown>;
      const transcript = typeof data['transcript'] === 'string' ? data['transcript'].trim() : '';
      const detected =
        typeof data['detected_language_code'] === 'string'
          ? data['detected_language_code']
          : detectLanguageFromScript(transcript);
      return {
        transcript,
        model: typeof data['model'] === 'string' ? data['model'] : model,
        ...(detected ? { language: detected } : {}),
        ...(typeof data['request_id'] === 'string' ? { requestId: data['request_id'] } : {}),
        latencyMs: Date.now() - started,
      };
    };

    try {
      return await withRetry(() => run(this.config.model), {
        maxAttempts: this.config.maxAttempts,
        baseDelayMs: 300,
      });
    } catch (error) {
      // Prisma v3.0 is opt-in. If the account is not enabled for it, degrade to v2.5 once.
      if (
        this.config.model === 'prisma-v3.0' &&
        error instanceof GnaniError &&
        error.failure === 'bad_request' &&
        /model/i.test(error.message)
      ) {
        return run('prisma-v2.5');
      }
      throw error;
    }
  }
}
