import { GnaniSttClient } from './infrastructure/gnani-stt-client';
import { GnaniTtsClient } from './infrastructure/gnani-tts-client';
import type { RealtimeSttConfig } from './infrastructure/gnani-realtime-stt';
import type { SpeechToTextPort, TextToSpeechPort } from './application/ports';
import type { TtsModel } from './domain/languages';

export * from './application/ports';
export * from './domain/errors';
export * from './domain/languages';
export * from './domain/audio';
export * from './http/routes';
export * from './infrastructure/gnani-stt-client';
export * from './infrastructure/gnani-tts-client';
export * from './infrastructure/gnani-realtime-stt';
export { withRetry } from './infrastructure/retry';

export interface GnaniSettings {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly sttModel: 'prisma-v3.0' | 'prisma-v2.5';
  readonly ttsModel: TtsModel;
  readonly ttsSampleRate: number;
}

export interface GnaniRuntime {
  readonly stt: SpeechToTextPort | undefined;
  readonly tts: TextToSpeechPort | undefined;
  readonly realtime: RealtimeSttConfig | undefined;
}

/** Builds Gnani clients from settings. With no API key every capability is simply absent. */
export function createGnaniRuntime(settings: GnaniSettings): GnaniRuntime {
  if (!settings.apiKey) return { stt: undefined, tts: undefined, realtime: undefined };
  return {
    stt: new GnaniSttClient({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.sttModel,
      timeoutMs: 20_000,
      maxAttempts: 3,
    }),
    tts: new GnaniTtsClient({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.ttsModel,
      timeoutMs: 20_000,
      maxAttempts: 2,
      sampleRate: settings.ttsSampleRate,
    }),
    realtime: {
      apiKey: settings.apiKey,
      wsBaseUrl: settings.baseUrl.replace(/^http/, 'ws'),
      model: settings.sttModel,
    },
  };
}
