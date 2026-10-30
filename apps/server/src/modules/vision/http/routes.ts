import {
  redStrokeDetectionResultSchema,
  redStrokeGestureRequestSchema,
  topologySchema,
  visionConfirmRequestSchema,
  visionExtractionSchema,
} from '@chaosboard/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { VisionService } from '../application/vision-service';

const extractRequestBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
});

export function registerVisionRoutes(app: FastifyInstance, visionService: VisionService): void {
  app.post('/api/vision/extract', async (request, reply) => {
    const body = extractRequestBodySchema.parse(request.body);
    const extraction = await visionService.extractDraft(body);
    const validated = visionExtractionSchema.parse(extraction);
    return reply.status(200).send(validated);
  });

  app.post('/api/vision/confirm', (request, reply) => {
    const body = visionConfirmRequestSchema.parse(request.body);
    const topology = visionService.confirmDraft(body.draft);
    const validated = topologySchema.parse(topology);
    return reply.status(200).send(validated);
  });

  app.post('/api/vision/gesture', async (request, reply) => {
    const body = redStrokeGestureRequestSchema.parse(request.body);
    const result = await visionService.detectGesture(body);
    const validated = redStrokeDetectionResultSchema.parse(result);
    return reply.status(200).send(validated);
  });
}
