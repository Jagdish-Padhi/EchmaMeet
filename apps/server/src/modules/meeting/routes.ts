import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MeetingAgentService, meetingAiRequestSchema } from './meeting-agent-service';
import { globalTranscriptStore } from './transcript-store';
import type { Topology } from '@chaosboard/contracts';

const transcriptChunkSchema = z.object({
  chunkId: z.string().min(1),
  audioBase64: z.string().min(1),
  speakerId: z.string().min(1),
  speakerName: z.string().min(1),
  timestampMs: z.number().int().positive(),
  recordingConsent: z.boolean(),
});

export function registerMeetingRoutes(
  app: FastifyInstance,
  meetingService: MeetingAgentService,
): void {
  // POST /api/rooms/:roomId/media-token
  app.post('/api/rooms/:roomId/media-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomId: string };
    const roomId = params.roomId?.trim() || 'default';
    const user = (request as any).user ?? { userId: 'guest', name: 'Reviewer' };

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

  // POST /api/rooms/:roomId/transcript - Meeting audio chunk transcription
  app.post('/api/rooms/:roomId/transcript', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomId: string };
    const roomId = params.roomId?.trim() || 'default';
    const validation = transcriptChunkSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        type: 'https://chaosboard.dev/errors/validation',
        title: 'Invalid Transcript Chunk',
        status: 400,
        detail: validation.error.issues.map((i) => i.message).join('; '),
      });
    }

    const { chunkId, audioBase64, speakerId, speakerName, timestampMs, recordingConsent } =
      validation.data;

    if (!recordingConsent) {
      return reply.status(403).send({
        type: 'https://chaosboard.dev/errors/unconsented',
        title: 'Recording Consent Required',
        status: 403,
        detail: 'Explicit participant recording consent is required for transcription processing.',
      });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length < 256) {
      return reply.status(200).send({
        id: chunkId,
        text: '',
        latencyMs: 0,
      });
    }

    const partnerKey =
      process.env['WHISPER_API_KEY'] ||
      process.env['META_SPEECH_API_KEY'] ||
      process.env['PARTNER_API_KEY'] ||
      process.env['GROQ_API_KEY'] ||
      process.env['OPENAI_API_KEY'];
    const baseUrl =
      process.env['WHISPER_BASE_URL'] ||
      process.env['PARTNER_BASE_URL'] ||
      'https://api.groq.com/openai/v1';

    let text = '';
    let latencyMs = 0;

    if (partnerKey) {
      const start = Date.now();
      try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'audio/webm' });
        formData.append('file', blob, 'audio.webm');
        formData.append(
          'model',
          baseUrl.includes('groq') ? 'whisper-large-v3-turbo' : 'whisper-1',
        );
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${partnerKey}` },
          body: formData,
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          text = data.text?.trim() ?? '';
        }
        latencyMs = Date.now() - start;
      } catch {
        text = '';
        latencyMs = Date.now() - start;
      }
    }

    if (text.length > 0) {
      globalTranscriptStore.addSegment({
        id: chunkId,
        roomId,
        speakerId,
        speakerName,
        text,
        timestampMs,
        durationMs: 4000,
      });
    }

    return reply.status(200).send({
      id: chunkId,
      text,
      speakerName,
      timestampMs,
      latencyMs,
    });
  });

  // GET /api/rooms/:roomId/transcripts - Retrieve persisted transcript segments
  app.get('/api/rooms/:roomId/transcripts', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomId: string };
    const roomId = params.roomId?.trim() || 'default';
    const segments = globalTranscriptStore.getSegments(roomId);
    return reply.status(200).send({ roomId, segments });
  });

  // POST /api/meeting/ai-opinion - Grounded Meta SRE AI Reasoning
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
        const result = await meetingService.evaluateMeetingContext({
          topology: parsed.data.topology as unknown as Topology,
          hostName: parsed.data.hostName,
          userPrompt: parsed.data.userPrompt,
          roomId: parsed.data.roomId,
          transcriptSegments: parsed.data.transcriptSegments,
          experimentSummary: parsed.data.experimentSummary,
        });
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

