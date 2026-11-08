import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { meetingAiRequestSchema, type MeetingAgentService } from './meeting-agent-service';
import { globalTranscriptStore } from './transcript-store';
import type { Topology } from '@chaosboard/contracts';
import type { SpeechToTextPort } from '../gnani';

const transcriptChunkSchema = z.object({
  chunkId: z.string().min(1),
  audioBase64: z.string().min(1),
  speakerId: z.string().min(1),
  speakerName: z.string().min(1),
  timestampMs: z.number().int().positive(),
  recordingConsent: z.boolean(),
});

export interface MeetingRoutesOptions {
  readonly stt?: SpeechToTextPort | undefined;
  readonly generateMediaToken?: (userId: string, roomId: string) => string;
}

export function registerMeetingRoutes(
  app: FastifyInstance,
  meetingService: MeetingAgentService,
  options?: MeetingRoutesOptions,
): void {
  // POST /api/rooms/:roomId/media-token
  app.post(
    '/api/rooms/:roomId/media-token',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { roomId: string };
      const roomId = params.roomId.trim() || 'default';
      const user =
        (request as unknown as { user?: { userId: string; name: string } }).user || {
          userId: `guest-${Date.now().toString(36)}`,
          name: 'Platform Engineer',
        };

      const token = options?.generateMediaToken
        ? options.generateMediaToken(user.userId, roomId)
        : `webrtc-${roomId}-${user.userId}-${Date.now().toString(36)}`;

      return reply.status(200).send({
        roomId,
        participantId: user.userId,
        token,
        provider: 'webrtc-mesh',
        wsUrl: `/ws/collaboration?room=${encodeURIComponent(roomId)}`,
      });
    },
  );

  // POST /api/rooms/:roomId/transcript - Meeting audio chunk transcription
  app.post(
    '/api/rooms/:roomId/transcript',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { roomId: string };
      const roomId = params.roomId.trim() || 'default';
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
          detail:
            'Explicit participant recording consent is required for transcription processing.',
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

      // Cost optimization guard: check PCM speech energy before calling Gnani Prisma API.
      // Drops silent gaps, background mic hiss, fan noise, and unvoiced audio without burning credits.
      if (buffer.length > 44) {
        let sum = 0;
        let peak = 0;
        const sampleCount = Math.floor((buffer.length - 44) / 2);
        for (let i = 0; i < sampleCount; i++) {
          const sample = buffer.readInt16LE(44 + i * 2) / 32768;
          const abs = Math.abs(sample);
          if (abs > peak) peak = abs;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / Math.max(1, sampleCount));
        if (rms < 0.015 && peak < 0.035) {
          return reply.status(200).send({
            id: chunkId,
            text: '',
            latencyMs: 0,
          });
        }
      }

      let transcription: Awaited<ReturnType<SpeechToTextPort['transcribe']>>;

      if (!options?.stt) {
        return reply.status(503).send({
          type: 'https://chaosboard.dev/errors/gnani-not-configured',
          title: 'Speech-to-text not configured',
          status: 503,
          detail: 'Set GNANI_API_KEY to transcribe meeting audio with Gnani Prisma.',
        });
      }
      try {
        // indic-auto lets Prisma follow the speaker across Hindi, English and code-mixed speech.
        const result = await options.stt.transcribe({
          audio: buffer,
          language: 'indic-auto',
          format: 'transcribe',
          topic: 'Live architecture review of a distributed system',
        });
        transcription = result;
      } catch (error) {
        request.log.warn(error, 'Gnani transcription failed for meeting chunk');
        return reply.status(502).send({
          type: 'https://chaosboard.dev/errors/gnani-stt-failed',
          title: 'Transcription failed',
          status: 502,
          detail: error instanceof Error ? error.message : 'Gnani transcription failed.',
        });
      }

      const { transcript: text, latencyMs, language } = transcription;
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
        ...(language ? { language } : {}),
      });
    },
  );

  // GET /api/rooms/:roomId/transcripts - Retrieve persisted transcript segments
  app.get(
    '/api/rooms/:roomId/transcripts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { roomId: string };
      const roomId = params.roomId.trim() || 'default';
      const segments = globalTranscriptStore.getSegments(roomId);
      return reply.status(200).send({ roomId, segments });
    },
  );

  // POST /api/meeting/ai-opinion - Grounded SRE review (rule engine, optional language model)
  app.post('/api/meeting/ai-opinion', async (request: FastifyRequest, reply: FastifyReply) => {
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
        language: parsed.data.language,
        roomId: parsed.data.roomId,
        transcriptSegments: parsed.data.transcriptSegments,
        experimentSummary: parsed.data.experimentSummary,
      });
      return await reply.status(200).send(result);
    } catch (err: unknown) {
      request.log.error(err, 'Failed to evaluate architecture');
      const message = err instanceof Error ? err.message : 'Unknown AI Evaluation Error';
      return await reply.status(502).send({
        type: 'https://chaosboard.dev/errors/model-failure',
        title: 'Architecture review failed',
        status: 502,
        detail: message,
      });
    }
  });
}
