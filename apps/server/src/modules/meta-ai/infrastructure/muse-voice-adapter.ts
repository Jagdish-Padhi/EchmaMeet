import { ModelCallError } from '../domain/errors';
import { inspectWav, isMuseCompatibleWav, pcm16Rms } from './wav';

export interface MuseVoiceConfig {
  readonly apiKey: string;
  /** Model API base, e.g. https://api.meta.ai/v1 */
  readonly baseUrl: string;
  readonly modelId?: string | undefined;
  /** Documented modes include ENDPOINTING, DIARIZATION and PUSH_TO_TALK. */
  readonly mode?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  /** Segments quieter than this RMS are skipped locally and never billed. */
  readonly silenceRmsThreshold?: number | undefined;
}

export interface MuseTurn {
  readonly turnId?: string | undefined;
  readonly startMs?: number | undefined;
  readonly endMs?: number | undefined;
  readonly transcript: string;
  readonly speaker?: string | number | undefined;
}

export interface MuseTranscription {
  readonly transcript: string;
  readonly turns: readonly MuseTurn[];
  readonly audioDurationMs: number;
  readonly latencyMs: number;
  readonly billedAudioMs: number;
  readonly skippedAsSilence: boolean;
  readonly modelId: string;
}

export const MUSE_VOICE_MODEL_ID = 'muse-voice-transcribe-1.0';

/**
 * Batch transcription through Muse Voice Transcribe (`POST {base}/asr/transcribe`, multipart:
 * a JSON `request` part and a WAV `audio` part). Rejects unsupported audio before the network
 * call, skips silence, and reports billed audio so the cost ledger is exact.
 */
export class MuseVoiceTranscriber {
  private readonly modelId: string;
  private readonly mode: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly silenceRms: number;
  private readonly endpoint: string;

  constructor(private readonly config: MuseVoiceConfig) {
    this.modelId = config.modelId ?? MUSE_VOICE_MODEL_ID;
    this.mode = config.mode ?? 'ENDPOINTING';
    this.timeoutMs = config.timeoutMs ?? 20_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.silenceRms = config.silenceRmsThreshold ?? 0.004;
    this.endpoint = `${config.baseUrl.replace(/\/$/, '')}/asr/transcribe`;
  }

  async transcribeWav(wav: Buffer, signal?: AbortSignal): Promise<MuseTranscription> {
    const info = inspectWav(wav);
    if (!isMuseCompatibleWav(info)) {
      throw new ModelCallError(
        'malformed_output',
        'Muse Voice Transcribe requires PCM16 mono WAV at 16 kHz or 24 kHz.',
      );
    }
    if (info.durationMs > 600_000) {
      throw new ModelCallError(
        'malformed_output',
        'Audio exceeds the 10 minute per-request limit.',
      );
    }
    if (pcm16Rms(wav, info) < this.silenceRms) {
      return {
        transcript: '',
        turns: [],
        audioDurationMs: info.durationMs,
        latencyMs: 0,
        billedAudioMs: 0,
        skippedAsSilence: true,
        modelId: this.modelId,
      };
    }

    const form = new FormData();
    form.append(
      'request',
      new Blob([JSON.stringify({ mode: this.mode, model: this.modelId, audioEncoding: 'WAV' })], {
        type: 'application/json',
      }),
    );
    form.append('audio', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const started = Date.now();
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const cls =
          res.status === 429 || res.status >= 500 ? 'transport_error' : 'malformed_output';
        throw new ModelCallError(
          cls,
          `Muse Voice Transcribe HTTP ${String(res.status)}: ${body.slice(0, 300)}`,
        );
      }
      const json = (await res.json()) as {
        transcript?: unknown;
        audioDurationMs?: unknown;
        turns?: unknown;
      };
      if (typeof json.transcript !== 'string') {
        throw new ModelCallError(
          'malformed_output',
          'Muse Voice Transcribe returned no transcript field.',
        );
      }
      const turns: MuseTurn[] = Array.isArray(json.turns)
        ? (json.turns as Record<string, unknown>[])
            .filter((t) => typeof t['transcript'] === 'string')
            .map((t) => ({
              turnId: typeof t['turnId'] === 'string' ? t['turnId'] : undefined,
              startMs: typeof t['startMs'] === 'number' ? t['startMs'] : undefined,
              endMs: typeof t['endMs'] === 'number' ? t['endMs'] : undefined,
              transcript: t['transcript'] as string,
              speaker:
                typeof t['speaker'] === 'string' || typeof t['speaker'] === 'number'
                  ? t['speaker']
                  : undefined,
            }))
        : [];
      return {
        transcript: json.transcript.trim(),
        turns,
        audioDurationMs:
          typeof json.audioDurationMs === 'number' ? json.audioDurationMs : info.durationMs,
        latencyMs: Date.now() - started,
        billedAudioMs: info.durationMs,
        skippedAsSilence: false,
        modelId: this.modelId,
      };
    } catch (err) {
      if (err instanceof ModelCallError) throw err;
      if (controller.signal.aborted) {
        throw new ModelCallError(
          'timeout',
          `Muse Voice Transcribe exceeded ${String(this.timeoutMs)}ms`,
        );
      }
      throw new ModelCallError(
        'transport_error',
        `Muse Voice Transcribe unreachable: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
