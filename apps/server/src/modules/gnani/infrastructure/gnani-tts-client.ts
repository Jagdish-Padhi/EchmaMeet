import { classifyHttpFailure, GnaniError } from '../domain/errors';
import { type GnaniLanguageCode, type TtsModel } from '../domain/languages';
import type { SynthesizeRequest, SynthesizeResult, TextToSpeechPort } from '../application/ports';
import { withRetry } from './retry';

export interface GnaniTtsConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: TtsModel;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly sampleRate: number;
  readonly fetchImpl?: typeof fetch | undefined;
}

const TIMBRE_V25_VOICES = new Set([
  'Kaveri',
  'Nalini',
  'Pooja',
  'Saanvi',
  'Trisha',
  'Suhana',
  'Reshma',
  'Zahira',
  'Kirra',
  'Falak',
  'Mehuli',
  'Aarohi',
  'Bhavini',
  'Charvi',
  'Eishani',
  'Falguni',
  'Gauri',
  'Janaki',
  'Kamakshi',
  'Madhuri',
  'Radhika',
  'Shweta',
  'Tanvi',
  'Vidya',
  'Wamika',
  'Yamini',
]);

const TIMBRE_V30_VOICES = new Set([
  'Riyaa',
  'Tarika',
  'Shivani',
  'Chetana',
  'Vasudha',
  'Lakshmi',
  'Kalpana',
  'Avinash',
  'Shubham',
  'Prakash',
  'Devansh',
  'Yashraj',
  'Harshad',
]);

const VOICE_CANONICAL_MAP: Record<string, { model: TtsModel; voice: string }> = {
  laxmi: { model: 'timbre-v3.0', voice: 'Lakshmi' },
  lakshmi: { model: 'timbre-v3.0', voice: 'Lakshmi' },
  riyaa: { model: 'timbre-v3.0', voice: 'Riyaa' },
  tarika: { model: 'timbre-v3.0', voice: 'Tarika' },
  shivani: { model: 'timbre-v3.0', voice: 'Shivani' },
  chetana: { model: 'timbre-v3.0', voice: 'Chetana' },
  vasudha: { model: 'timbre-v3.0', voice: 'Vasudha' },
  kalpana: { model: 'timbre-v3.0', voice: 'Kalpana' },
  kaveri: { model: 'timbre-v2.5', voice: 'Kaveri' },
  nalini: { model: 'timbre-v2.5', voice: 'Nalini' },
  saanvi: { model: 'timbre-v2.5', voice: 'Saanvi' },
  trisha: { model: 'timbre-v2.5', voice: 'Trisha' },
  aarohi: { model: 'timbre-v2.5', voice: 'Aarohi' },
  suhana: { model: 'timbre-v2.5', voice: 'Suhana' },
};

function deriveModelAndVoice(
  configModel: TtsModel,
  language: GnaniLanguageCode,
  requestedVoice?: string,
): { model: TtsModel; voice: string } {
  const req = requestedVoice?.trim();
  if (req) {
    const canonical = VOICE_CANONICAL_MAP[req.toLowerCase()];
    if (canonical) return canonical;
    if (TIMBRE_V25_VOICES.has(req)) {
      return { model: 'timbre-v2.5', voice: req };
    }
    if (TIMBRE_V30_VOICES.has(req)) {
      return { model: 'timbre-v3.0', voice: req };
    }
    return { model: configModel, voice: req };
  }
  // Default: Lakshmi is the highly expressive, human, and dynamic voice for English on timbre-v3.0
  if (language === 'hi-IN') {
    return configModel === 'timbre-v2.5'
      ? { model: 'timbre-v2.5', voice: 'Nalini' }
      : { model: 'timbre-v3.0', voice: 'Lakshmi' };
  }
  return configModel === 'timbre-v2.5'
    ? { model: 'timbre-v2.5', voice: 'Kaveri' }
    : { model: 'timbre-v3.0', voice: 'Lakshmi' };
}

export class GnaniTtsClient implements TextToSpeechPort {
  private static readonly MAX_CACHE_SIZE = 150;
  private readonly cache = new Map<
    string,
    { readonly audio: Uint8Array; readonly contentType: string; readonly voice: string; readonly model: string }
  >();

  constructor(private readonly config: GnaniTtsConfig) {}

  async synthesize(request: SynthesizeRequest): Promise<SynthesizeResult> {
    if (!this.config.apiKey) {
      throw new GnaniError('not_configured', 'GNANI_API_KEY is not set.');
    }
    const text = request.text.trim();
    if (text === '') throw new GnaniError('bad_request', 'Nothing to synthesise.');
    const language: GnaniLanguageCode = request.language;
    const started = Date.now();

    const { model, voice } = deriveModelAndVoice(this.config.model, language, request.voice);
    const speed = Math.max(0.85, Math.min(1.15, request.speed ?? 1.0));

    const cacheKey = `${model}:${voice}:${language}:${speed.toFixed(2)}:${text.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        audio: cached.audio.slice(0),
        contentType: cached.contentType,
        voice: cached.voice,
        model: cached.model,
        latencyMs: 1,
      };
    }

    const makePayload = (m: TtsModel, v: string) => ({
      text: text.slice(0, 1000),
      voice: v,
      model: m,
      language,
      // Gnani Timbre: 1.0 provides the pure, authentic, unadulterated native voice as provided by Gnani
      speed,
      audio_config: {
        sample_rate: this.config.sampleRate,
        num_channels: 1,
        sample_width: 2,
        encoding: 'linear_pcm',
        container: 'wav',
      },
    });

    const call = async (): Promise<SynthesizeResult> => {
      const fetchImpl = this.config.fetchImpl ?? fetch;
      let payload = makePayload(model, voice);
      let response: Response;

      try {
        response = await fetchImpl(`${this.config.baseUrl}/api/v1/tts/inference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': this.config.apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
      } catch (cause) {
        const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
        throw new GnaniError(timedOut ? 'timeout' : 'upstream', 'Gnani TTS request failed.', {
          cause,
        });
      }

      // If requested model returns 400 (e.g. voice model mismatch), seamlessly fallback to alternate model
      if (!response.ok && response.status === 400) {
        const fallbackModel: TtsModel = model === 'timbre-v3.0' ? 'timbre-v2.5' : 'timbre-v3.0';
        const fallbackVoice = fallbackModel === 'timbre-v3.0' ? 'Lakshmi' : 'Kaveri';
        payload = makePayload(fallbackModel, fallbackVoice);
        try {
          const fbResponse = await fetchImpl(`${this.config.baseUrl}/api/v1/tts/inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': this.config.apiKey },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeoutMs),
          });
          if (fbResponse.ok) {
            response = fbResponse;
          }
        } catch {
          // ignore fallback error and classify original
        }
      }

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => undefined);
        throw classifyHttpFailure(response.status, body);
      }
      const audio = new Uint8Array(await response.arrayBuffer());

      // Gnani sends 0xFFFFFFFF in RIFF and data chunk sizes for streaming containers.
      // Standard browser AudioContext.decodeAudioData rejects 0xFFFFFFFF as an invalid/truncated WAV file.
      // Patch the canonical RIFF and data chunk lengths so browser Web Audio decodes seamlessly.
      if (
        audio.length >= 44 &&
        audio[0] === 0x52 &&
        audio[1] === 0x49 &&
        audio[2] === 0x46 &&
        audio[3] === 0x46
      ) {
        const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
        view.setUint32(4, audio.length - 8, true);
        for (let i = 12; i < audio.length - 8; i++) {
          if (
            audio[i] === 0x64 &&
            audio[i + 1] === 0x61 &&
            audio[i + 2] === 0x74 &&
            audio[i + 3] === 0x61
          ) {
            view.setUint32(i + 4, audio.length - (i + 8), true);
            break;
          }
        }
      }

      if (this.cache.size >= GnaniTtsClient.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, {
        audio,
        contentType: 'audio/wav',
        voice: payload.voice,
        model: payload.model,
      });

      return {
        audio,
        contentType: 'audio/wav',
        voice: payload.voice,
        model: payload.model,
        latencyMs: Date.now() - started,
      };
    };

    return withRetry(call, { maxAttempts: this.config.maxAttempts, baseDelayMs: 300 });
  }
}
