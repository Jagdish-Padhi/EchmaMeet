import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Topology } from '@chaosboard/contracts';
import { buildIceConfiguration, type IceSettings } from '../../platform/ice';
import { RoomRegistry } from '../../platform/rooms';
import { meetingAiRequestSchema, type MeetingAgentService } from './meeting-agent-service';

const transcriptChunkSchema = z.object({
  chunkId: z.string().min(1).max(160),
  audioBase64: z.string().min(1),
  // Accepted for wire compatibility, never trusted: identity comes from the session.
  speakerId: z.string().min(1).optional(),
  speakerName: z.string().min(1).optional(),
  timestampMs: z.number().int().positive(),
  recordingConsent: z.boolean(),
});

export interface MeetingTranscriber {
  transcribeWav(wav: Buffer): Promise<{
    transcript: string;
    latencyMs: number;
    audioDurationMs: number;
    billedAudioMs: number;
    skippedAsSilence: boolean;
    modelId: string;
  }>;
}

/** Experiment evidence derived from a stored run record, never from the client. */
export interface MeetingExperimentEvidence {
  readonly completionRate?: number | null | undefined;
  readonly p99LatencyMs?: number | null | undefined;
  readonly verdicts?: readonly unknown[] | undefined;
}

export interface MeetingRoutesOptions {
  /** Looks up verified run evidence by id; returns null when the run does not exist. */
  readonly loadExperimentEvidence?:
    ((runId: string) => MeetingExperimentEvidence | null) | undefined;
  readonly rooms: RoomRegistry;
  readonly ice: IceSettings;
  readonly generateMediaToken: (userId: string, roomId: string) => string;
  /** Present only when a real speech provider is configured. */
  readonly transcriber?: MeetingTranscriber | undefined;
  readonly onTranscribed?:
    ((info: { modelId: string; billedAudioMs: number; latencyMs: number }) => void) | undefined;
}

interface SessionUser {
  userId: string;
  name: string;
}

function problem(reply: FastifyReply, status: number, title: string, detail: string) {
  return reply.status(status).send({
    type: `https://chaosboard.dev/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
  });
}

export function registerMeetingRoutes(
  app: FastifyInstance,
  meetingService: MeetingAgentService,
  options: MeetingRoutesOptions,
): void {
  const { rooms } = options;

  /** Resolves the session user and enforces room membership. Replies and returns null on failure. */
  const requireMember = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): { user: SessionUser; roomId: string } | null => {
    const user = (request as unknown as { user?: SessionUser }).user;
    if (!user) {
      void problem(reply, 401, 'Unauthorized', 'Authentication is required.');
      return null;
    }
    const roomId = (request.params as { roomId: string }).roomId.trim();
    if (!RoomRegistry.isValidRoomId(roomId)) {
      void problem(reply, 400, 'Invalid Room', 'Room identifier is malformed.');
      return null;
    }
    if (!rooms.isMember(user.userId, roomId)) {
      void problem(reply, 403, 'Forbidden', 'You are not a member of this room.');
      return null;
    }
    return { user, roomId };
  };

  // Signed, short-lived token binding a user to a room's media signaling.
  app.post('/api/rooms/:roomId/media-token', async (request, reply) => {
    const ctx = requireMember(request, reply);
    if (!ctx) return reply;
    return reply.status(200).send({
      roomId: ctx.roomId,
      participantId: ctx.user.userId,
      token: options.generateMediaToken(ctx.user.userId, ctx.roomId),
      provider: 'webrtc-mesh',
      wsUrl: `/ws/collaboration?room=${encodeURIComponent(ctx.roomId)}`,
    });
  });

  // Per-user ICE servers: STUN plus short-lived TURN credentials when a relay is configured.
  app.get('/api/rooms/:roomId/ice-servers', async (request, reply) => {
    const ctx = requireMember(request, reply);
    if (!ctx) return reply;
    return reply.status(200).send(buildIceConfiguration(options.ice, ctx.user.userId));
  });

  // Owner controls: lock a room so no new participants can be admitted.
  app.post('/api/rooms/:roomId/lock', async (request, reply) => {
    const ctx = requireMember(request, reply);
    if (!ctx) return reply;
    const body = z.object({ locked: z.boolean() }).safeParse(request.body);
    if (!body.success)
      return problem(reply, 400, 'Validation', 'Body must be {"locked": boolean}.');
    if (!rooms.setLocked(ctx.user.userId, ctx.roomId, body.data.locked)) {
      return problem(reply, 403, 'Forbidden', 'Only the room owner can lock or unlock the room.');
    }
    return reply.status(200).send({ roomId: ctx.roomId, locked: body.data.locked });
  });

  // Audio chunk transcription through Muse Voice Transcribe.
  app.post('/api/rooms/:roomId/transcript', async (request, reply) => {
    const ctx = requireMember(request, reply);
    if (!ctx) return reply;
    const validation = transcriptChunkSchema.safeParse(request.body);
    if (!validation.success) {
      return problem(
        reply,
        400,
        'Invalid Transcript Chunk',
        validation.error.issues.map((i) => i.message).join('; '),
      );
    }
    const { chunkId, audioBase64, timestampMs, recordingConsent } = validation.data;
    if (!recordingConsent) {
      return problem(
        reply,
        403,
        'Recording Consent Required',
        'Explicit participant recording consent is required for transcription processing.',
      );
    }
    if (!options.transcriber) {
      // Never pretend: without a configured speech provider the feature is unavailable.
      return problem(
        reply,
        503,
        'Speech Not Configured',
        'Muse Voice Transcribe is not configured (set META_API_KEY).',
      );
    }

    const wav = Buffer.from(audioBase64, 'base64');
    try {
      const result = await options.transcriber.transcribeWav(wav);
      const text = result.transcript;
      if (text.length > 0) {
        rooms.addTranscript({
          id: chunkId,
          roomId: ctx.roomId,
          speakerId: ctx.user.userId,
          speakerName: ctx.user.name,
          text,
          timestampMs,
          durationMs: result.audioDurationMs,
          modelId: result.modelId,
        });
      }
      options.onTranscribed?.({
        modelId: result.modelId,
        billedAudioMs: result.billedAudioMs,
        latencyMs: result.latencyMs,
      });
      return await reply.status(200).send({
        id: chunkId,
        text,
        speakerName: ctx.user.name,
        timestampMs,
        latencyMs: result.latencyMs,
        skippedAsSilence: result.skippedAsSilence,
      });
    } catch (err) {
      request.log.warn(err, 'Muse Voice Transcribe failed');
      return problem(
        reply,
        502,
        'Transcription Failed',
        err instanceof Error ? err.message : 'Unknown transcription error',
      );
    }
  });

  app.get('/api/rooms/:roomId/transcripts', async (request, reply) => {
    const ctx = requireMember(request, reply);
    if (!ctx) return reply;
    return reply.status(200).send({
      roomId: ctx.roomId,
      segments: rooms.listTranscripts(ctx.roomId),
    });
  });

  // POST /api/meeting/ai-opinion - Grounded Meta SRE AI Reasoning
  app.post('/api/meeting/ai-opinion', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user?: { userId: string } }).user;
    if (!user) {
      return problem(
        reply,
        401,
        'Unauthorized',
        'Authentication required to invoke meeting AI copilot.',
      );
    }

    const parsed = meetingAiRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        type: 'https://chaosboard.dev/errors/validation',
        title: 'Invalid Meeting AI Request',
        status: 400,
        detail: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    // All evidence is retrieved server-side. The caller supplies only identifiers (room, run);
    // it can never inject transcript lines or experiment results of its own.
    const requestedRoom = parsed.data.roomId.trim();
    if (!rooms.isMember(user.userId, requestedRoom)) {
      return problem(reply, 403, 'Forbidden', 'You are not a member of this room.');
    }
    const transcriptSegments = rooms.listTranscripts(requestedRoom, 40).map((seg) => ({
      id: seg.id,
      speakerName: seg.speakerName,
      text: seg.text,
      timestampMs: seg.timestampMs,
    }));
    let experimentSummary: MeetingExperimentEvidence | undefined;
    if (parsed.data.runId) {
      const evidence = options.loadExperimentEvidence?.(parsed.data.runId);
      if (!evidence) {
        return problem(reply, 404, 'Run Not Found', 'The referenced run does not exist.');
      }
      experimentSummary = evidence;
    }

    try {
      const result = await meetingService.evaluateMeetingContext({
        topology: parsed.data.topology as unknown as Topology,
        hostName: parsed.data.hostName,
        userPrompt: parsed.data.userPrompt,
        roomId: requestedRoom,
        transcriptSegments,
        experimentSummary,
      });
      return await reply.status(200).send(result);
    } catch (err: unknown) {
      request.log.error(err, 'Failed to evaluate architecture via Meta AI');
      const message = err instanceof Error ? err.message : 'Unknown AI Evaluation Error';
      return await reply.status(502).send({
        type: 'https://chaosboard.dev/errors/model-failure',
        title: 'Meta AI Evaluation Error',
        status: 502,
        detail: message,
      });
    }
  });
}
