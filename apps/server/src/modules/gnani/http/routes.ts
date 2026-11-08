import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  GnaniError,
  GNANI_LANGUAGES,
  isGnaniLanguage,
  TIMBRE_V25_VOICES,
} from '../application/catalog';
import type { SpeechToTextPort, TextToSpeechPort } from '../application/ports';

export interface GnaniRoutesOptions {
  readonly stt?: SpeechToTextPort | undefined;
  readonly tts?: TextToSpeechPort | undefined;
  readonly sttModel: string;
  readonly ttsModel: string;
}

const sttBodySchema = z.object({
  audioBase64: z.string().min(1).max(8_000_000),
  language: z.string().max(40).default('indic-auto'),
  format: z.enum(['verbatim', 'transcribe', 'codemix', 'transliterate']).default('transcribe'),
  keyterms: z.array(z.string().max(80)).max(200).default([]),
});

const ttsBodySchema = z.object({
  text: z.string().min(1).max(10000),
  language: z.string().default('en-IN'),
  voice: z.string().max(40).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

/** 30 s of 16 kHz mono WAV is ~1 MB, ~1.3 MB once base64-encoded; Fastify's default is 1 MB. */
const AUDIO_BODY_LIMIT = 4_000_000;

export function registerGnaniRoutes(app: FastifyInstance, options: GnaniRoutesOptions): void {
  app.get('/api/gnani/health', (_request, reply) =>
    reply.code(200).send({
      status: options.stt && options.tts ? 'configured' : 'unconfigured',
      speechToText: { provider: 'gnani', model: options.sttModel, enabled: Boolean(options.stt) },
      textToSpeech: { provider: 'gnani', model: options.ttsModel, enabled: Boolean(options.tts) },
      message:
        options.stt && options.tts
          ? 'Gnani Prisma and Timbre are configured.'
          : 'Set GNANI_API_KEY (from app.gnani.ai/voice) to enable Prisma speech-to-text and Timbre text-to-speech.',
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/api/gnani/languages', (_request, reply) =>
    reply.code(200).send({
      languages: GNANI_LANGUAGES,
      auto: 'indic-auto',
      defaultVoices: TIMBRE_V25_VOICES,
    }),
  );

  app.post('/api/gnani/stt', { bodyLimit: AUDIO_BODY_LIMIT }, async (request, reply) => {
    if (!options.stt) throw new GnaniError('not_configured', 'GNANI_API_KEY is not set.');
    const body = sttBodySchema.parse(request.body);
    const result = await options.stt.transcribe({
      audio: Buffer.from(body.audioBase64, 'base64'),
      language: body.language,
      format: body.format,
      keyterms: body.keyterms,
    });
    return reply.code(200).send(result);
  });

  app.post('/api/gnani/tts', async (request, reply) => {
    if (!options.tts) throw new GnaniError('not_configured', 'GNANI_API_KEY is not set.');
    const body = ttsBodySchema.parse(request.body);
    const language = isGnaniLanguage(body.language) ? body.language : 'en-IN';
    const result = await options.tts.synthesize({
      text: body.text.slice(0, 1000),
      language,
      voice: body.voice,
      speed: body.speed !== undefined ? Math.max(0.85, Math.min(1.15, body.speed)) : 1.0,
    });
    return reply
      .code(200)
      .header('Content-Type', result.contentType)
      .header('X-Gnani-Voice', result.voice)
      .header('X-Gnani-Latency-Ms', String(result.latencyMs))
      .send(Buffer.from(result.audio));
  });
}
