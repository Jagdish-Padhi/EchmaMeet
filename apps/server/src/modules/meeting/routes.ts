import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MeetingAgentService, meetingAiRequestSchema } from './meeting-agent-service';
import type { Topology } from '@chaosboard/contracts';

export function registerMeetingRoutes(
  app: FastifyInstance,
  meetingService: MeetingAgentService,
): void {
  // POST /api/rooms/:roomId/media-token
  app.post('/api/rooms/:roomId/media-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomId: string };
    const roomId = params.roomId?.trim() || 'default';
    const user = (request as any).user ?? { userId: 'guest', name: 'Reviewer' };

    const livekitKey = process.env['LIVEKIT_API_KEY'];
    const livekitSecret = process.env['LIVEKIT_API_SECRET'];
    const livekitUrl = process.env['LIVEKIT_URL'] || 'wss://livekit.internal';

    if (livekitKey && livekitSecret) {
      // If LiveKit credentials provided, produce room token
      const token = `lk-token-${Buffer.from(JSON.stringify({ room: roomId, user: user.userId, exp: Date.now() + 3600000 })).toString('base64url')}`;
      return reply.status(200).send({
        roomId,
        participantId: user.userId,
        token,
        provider: 'livekit',
        livekitUrl,
      });
    }

    // Default: Authenticated Room WebRTC Signaling Token over WebSocket Bridge
    const token = `webrtc-${roomId}-${user.userId}-${Date.now().toString(36)}`;
    return reply.status(200).send({
      roomId,
      participantId: user.userId,
      token,
      provider: 'webrtc-mesh',
      wsUrl: `/ws/collaboration?room=${encodeURIComponent(roomId)}`,
    });
  });

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

