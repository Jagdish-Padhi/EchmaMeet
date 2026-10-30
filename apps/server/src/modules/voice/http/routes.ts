import { voiceIntentParseResultSchema } from '@chaosboard/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { VoiceService } from '../application/voice-service';

const topologyRefSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const edgeRefSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

const parseVoiceCommandBodySchema = z.object({
  transcript: z.string().optional(),
  audioBase64: z.string().optional(),
  audioDurationMs: z.number().int().min(0).optional(),
  nodes: z.array(topologyRefSchema).default([]),
  edges: z.array(edgeRefSchema).default([]),
});

export function registerVoiceRoutes(app: FastifyInstance, voiceService: VoiceService): void {
  app.post('/api/voice/parse', async (request, reply) => {
    const body = parseVoiceCommandBodySchema.parse(request.body);
    const result = await voiceService.parseCommand(body);
    const validated = voiceIntentParseResultSchema.parse(result);
    return reply.status(200).send(validated);
  });
}
