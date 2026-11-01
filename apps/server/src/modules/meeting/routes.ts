import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MeetingAgentService, meetingAiRequestSchema } from './meeting-agent-service';
import type { Topology } from '@chaosboard/contracts';

export function registerMeetingRoutes(
  app: FastifyInstance,
  meetingService: MeetingAgentService,
): void {
  app.post(
    '/api/meeting/ai-opinion',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = meetingAiRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          type: 'https://chaosboard.dev/errors/validation',
          title: 'Invalid Meeting AI Request',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      try {
        const result = await meetingService.evaluateMeetingContext(
          parsed.data.topology as unknown as Topology,
          parsed.data.hostName,
          parsed.data.userPrompt,
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        request.log.error(err, 'Failed to evaluate architecture via Meta AI');
        const message = err instanceof Error ? err.message : 'Unknown AI Evaluation Error';
        return reply.status(502).send({
          type: 'https://chaosboard.dev/errors/model-failure',
          title: 'Meta AI Evaluation Error',
          status: 502,
          detail: message,
        });
      }
    },
  );
}

