import { voiceIntentParseResultSchema } from '@chaosboard/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { VoiceService } from '../application/voice-service';

const topologyRefSchema = z.object({ id: z.string(), label: z.string() });
const edgeRefSchema = z.object({ id: z.string(), source: z.string(), target: z.string() });

const parseVoiceCommandBodySchema = z.object({
  transcript: z.string().max(2000).optional(),
  audioBase64: z.string().max(8_000_000).optional(),
  audioDurationMs: z.number().int().min(0).optional(),
  language: z.string().max(40).optional(),
  speakReply: z.boolean().default(false),
  nodes: z.array(topologyRefSchema).default([]),
  edges: z.array(edgeRefSchema).default([]),
});

/** 30 s of 16 kHz mono WAV is ~1 MB, ~1.3 MB once base64-encoded; Fastify's default is 1 MB. */
const AUDIO_BODY_LIMIT = 4_000_000;

export function registerVoiceRoutes(app: FastifyInstance, voiceService: VoiceService): void {
  app.post('/api/voice/parse', { bodyLimit: AUDIO_BODY_LIMIT }, async (request, reply) => {
    const body = parseVoiceCommandBodySchema.parse(request.body);
    const result = voiceIntentParseResultSchema.parse(await voiceService.parseCommand(body));
    if (!body.speakReply) {
      await voiceService.log(result, { source: 'http' });
      return reply.status(200).send(result);
    }
    const speech = await voiceService.speak(result);
    await voiceService.log(result, { source: 'http', ttsMs: speech?.latencyMs });
    return reply.status(200).send({
      ...result,
      speech: speech
        ? {
            audioBase64: Buffer.from(speech.audio).toString('base64'),
            contentType: speech.contentType,
            voice: speech.voice,
            latencyMs: speech.latencyMs,
          }
        : null,
    });
  });
}
