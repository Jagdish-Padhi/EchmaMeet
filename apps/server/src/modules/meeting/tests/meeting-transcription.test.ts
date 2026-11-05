import { describe, it, expect, beforeEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';
import type { Topology } from '@chaosboard/contracts';
import { registerMeetingRoutes, type MeetingTranscriber } from '../routes';
import { MeetingAgentService } from '../meeting-agent-service';
import type { StructuredModelPort } from '../../meta-ai';
import { IN_MEMORY, openDatabase } from '../../../platform/db';
import { runMigrations } from '../../../platform/migrations';
import { moduleMigrations } from '../../../module-migrations';
import { RoomRegistry } from '../../../platform/rooms';
import { systemClock } from '../../../platform/system-clock';

const ALEX = { userId: 'eng-alex', name: 'Alex Chen' };
const BOB = { userId: 'eng-bob', name: 'Bob' };

function setup(options?: {
  model?: StructuredModelPort;
  transcriber?: MeetingTranscriber | null;
  loadExperimentEvidence?: (
    runId: string,
  ) => { completionRate?: number; verdicts?: unknown[] } | null;
}) {
  const db = openDatabase(IN_MEMORY);
  runMigrations(db, moduleMigrations, systemClock);
  const rooms = new RoomRegistry(db);
  const app: FastifyInstance = fastify();
  // The real auth guard is covered in auth.test.ts; here the session user comes from a header.
  app.addHook('onRequest', async (req) => {
    const who = req.headers['x-test-user'];
    if (who === 'bob') (req as unknown as { user: typeof BOB }).user = BOB;
    else if (who === 'alex') (req as unknown as { user: typeof ALEX }).user = ALEX;
  });
  const model: StructuredModelPort =
    options?.model ??
    ({
      generateStructured: () => Promise.reject(new Error('model should not be called')),
    } as StructuredModelPort);
  const transcriber: MeetingTranscriber | undefined =
    options?.transcriber === null
      ? undefined
      : (options?.transcriber ?? {
          transcribeWav: () =>
            Promise.resolve({
              transcript: 'the payment service is stalling downstream calls',
              latencyMs: 42,
              audioDurationMs: 4000,
              billedAudioMs: 4000,
              skippedAsSilence: false,
              modelId: 'muse-voice-transcribe-1.0',
            }),
        });
  registerMeetingRoutes(app, new MeetingAgentService(model), {
    rooms,
    ice: {
      stunUrls: ['stun:stun.example.org:3478'],
      turnUrls: ['turn:turn.example.org:3478?transport=udp'],
      turnSharedSecret: 'turn-secret',
      turnTtlSeconds: 600,
    },
    generateMediaToken: (u, r) => `tok-${u}-${r}`,
    loadExperimentEvidence: options?.loadExperimentEvidence,
    transcriber,
  });
  return { app, rooms, db };
}

const chunk = (id: string, consent = true) => ({
  chunkId: id,
  audioBase64: Buffer.from('ignored-by-fake-transcriber').toString('base64'),
  timestampMs: 1_700_000_000_000,
  recordingConsent: consent,
});

describe('meeting routes: membership, transcription, ICE, copilot grounding', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
    ctx.rooms.admit(ALEX.userId, 'room-1');
  });

  it('rejects unauthenticated and non-member access to room data', async () => {
    const anon = await ctx.app.inject({ method: 'GET', url: '/api/rooms/room-1/transcripts' });
    expect(anon.statusCode).toBe(401);
    const outsider = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms/room-1/transcripts',
      headers: { 'x-test-user': 'bob' },
    });
    expect(outsider.statusCode).toBe(403);
    for (const path of ['media-token', 'ice-servers']) {
      const method = path === 'media-token' ? 'POST' : 'GET';
      const res = await ctx.app.inject({
        method,
        url: `/api/rooms/room-1/${path}`,
        headers: { 'x-test-user': 'bob' },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it('requires recording consent before any audio is processed', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms/room-1/transcript',
      headers: { 'x-test-user': 'alex' },
      payload: chunk('c1', false),
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).title).toBe('Recording Consent Required');
  });

  it('persists transcripts durably, de-duplicates retries, and stamps the verified speaker', async () => {
    const send = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/rooms/room-1/transcript',
        headers: { 'x-test-user': 'alex' },
        // A client lying about who is speaking is ignored.
        payload: { ...chunk('c-dup'), speakerId: 'eng-bob', speakerName: 'Mallory' },
      });
    expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(200); // network retry of the same chunk

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms/room-1/transcripts',
      headers: { 'x-test-user': 'alex' },
    });
    const body = JSON.parse(list.body) as {
      segments: { speakerId: string; speakerName: string; modelId: string }[];
    };
    expect(body.segments).toHaveLength(1);
    expect(body.segments[0]).toMatchObject({
      speakerId: 'eng-alex',
      speakerName: 'Alex Chen',
      modelId: 'muse-voice-transcribe-1.0',
    });
  });

  it('answers 503 instead of faking a transcript when no speech provider is configured', async () => {
    const bare = setup({ transcriber: null });
    bare.rooms.admit(ALEX.userId, 'room-1');
    const res = await bare.app.inject({
      method: 'POST',
      url: '/api/rooms/room-1/transcript',
      headers: { 'x-test-user': 'alex' },
      payload: chunk('c-none'),
    });
    expect(res.statusCode).toBe(503);
  });

  it('surfaces provider failures as 502 and stores nothing', async () => {
    const failing = setup({
      transcriber: {
        transcribeWav: () => Promise.reject(new Error('Muse Voice Transcribe HTTP 429')),
      },
    });
    failing.rooms.admit(ALEX.userId, 'room-1');
    const res = await failing.app.inject({
      method: 'POST',
      url: '/api/rooms/room-1/transcript',
      headers: { 'x-test-user': 'alex' },
      payload: chunk('c-fail'),
    });
    expect(res.statusCode).toBe(502);
    expect(failing.rooms.listTranscripts('room-1')).toHaveLength(0);
  });

  it('issues per-user, expiring coturn credentials that verify against the shared secret', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms/room-1/ice-servers',
      headers: { 'x-test-user': 'alex' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      turnConfigured: boolean;
      iceServers: { urls: string[]; username?: string; credential?: string }[];
    };
    expect(body.turnConfigured).toBe(true);
    const turn = body.iceServers.find((s) => s.username);
    expect(turn?.username).toMatch(/^\d+:eng-alex$/);
    const expected = createHmac('sha1', 'turn-secret')
      .update(turn?.username ?? '')
      .digest('base64');
    expect(turn?.credential).toBe(expected);
  });

  it('lets only the owner lock a room, and a locked room admits no newcomers', async () => {
    const asBob = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms/room-1/lock',
      headers: { 'x-test-user': 'bob' },
      payload: { locked: true },
    });
    expect(asBob.statusCode).toBe(403);
    const asOwner = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms/room-1/lock',
      headers: { 'x-test-user': 'alex' },
      payload: { locked: true },
    });
    expect(asOwner.statusCode).toBe(200);
    expect(ctx.rooms.admit(BOB.userId, 'room-1')).toEqual({ ok: false, reason: 'locked' });
  });

  it('grounds the copilot in server-held transcripts and drops hallucinated entities', async () => {
    let captured: { liveMeetingTranscripts: string } | null = null;
    const model: StructuredModelPort = {
      generateStructured<T>(params: { messages: readonly { content: string }[] }) {
        captured = JSON.parse(params.messages[1]?.content ?? '{}') as {
          liveMeetingTranscripts: string;
        };
        return Promise.resolve({
          data: {
            handRaised: true,
            spokenOpinion: 'Checkout retries without jitter will amplify inventory latency.',
            identifiedRisk: 'Retry storm',
            supportingTranscriptReferences: [
              {
                speaker: 'Alex Chen',
                timestampMs: 1,
                quote: 'the payment service is stalling downstream calls',
              },
              { speaker: 'Alex Chen', timestampMs: 2, quote: 'zebra unicorn quantum' },
            ],
            affectedNodeIds: ['checkout', 'ghost-node'],
            affectedEdgeIds: ['checkout-to-inventory'],
            facts: ['Checkout retry maxAttempts is 3.'],
            assumptions: [],
            confidence: 0.9,
            hazards: [
              {
                id: 'real',
                title: 'Retry storm',
                severity: 'high',
                risk: 'r',
                recommendation: 'x',
                targetEdgeId: 'checkout-to-inventory',
              },
              {
                id: 'fake',
                title: 'Ghost',
                severity: 'high',
                risk: 'r',
                recommendation: 'x',
                targetNodeId: 'does-not-exist',
              },
            ],
          } as unknown as T,
          rawOutput: '{}',
          metadata: {
            provider: 'meta',
            modelId: 'muse-spark-1.3',
            promptVersion: 'v1',
            latencyMs: 5,
          },
        });
      },
    };
    const grounded = setup({ model });
    grounded.rooms.admit(ALEX.userId, 'room-g');
    grounded.rooms.addTranscript({
      id: 'seg-1',
      roomId: 'room-g',
      speakerId: ALEX.userId,
      speakerName: 'Alex Chen',
      text: 'the payment service is stalling downstream calls',
      timestampMs: 1,
      durationMs: 4000,
      modelId: 'muse-voice-transcribe-1.0',
    });
    const testTopology: Topology = {
      schemaVersion: 1,
      id: 'meeting-test-topo' as any,
      name: 'Meeting Test Topo',
      source: 'scenario',
      entry: { nodeId: 'checkout' as any },
      nodes: [
        {
          id: 'checkout' as any,
          label: 'Checkout Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'checkout-to-inventory' as any,
          source: 'checkout' as any,
          target: 'inventory' as any,
          mode: 'sync_call',
          policy: {
            timeoutMs: 1000,
            retry: {
              maxAttempts: 3,
              backoffBaseMs: 0,
              backoffMultiplier: 1,
              maxBackoffMs: 0,
              jitter: 'none',
            },
            breaker: {
              enabled: false,
              failureThresholdPct: 50,
              windowRequests: 10,
              cooldownMs: 5000,
              halfOpenProbes: 3,
            },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 10 },
          },
        },
      ],
    };

    const res = await grounded.app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      headers: { 'x-test-user': 'alex' },
      payload: {
        topology: testTopology,
        hostName: 'Alex Chen',
        roomId: 'room-g',
        // Client-supplied transcript is ignored in favour of the server's record.
        transcriptSegments: [{ speakerName: 'Mallory', text: 'forged line' }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      hazards: { id: string }[];
      affectedNodeIds: string[];
      supportingTranscriptReferences: { quote: string }[];
    };
    expect(
      (captured as { liveMeetingTranscripts: string } | null)?.liveMeetingTranscripts,
    ).toContain('stalling downstream');
    expect(
      (captured as { liveMeetingTranscripts: string } | null)?.liveMeetingTranscripts,
    ).not.toContain('forged line');
    expect(body.hazards.map((h) => h.id)).toEqual(['real']);
    expect(body.affectedNodeIds).toEqual(['checkout']);
    expect(body.supportingTranscriptReferences).toHaveLength(1);

    const outsider = await grounded.app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      headers: { 'x-test-user': 'bob' },
      payload: { topology: testTopology, hostName: 'Bob', roomId: 'room-g' },
    });
    expect(outsider.statusCode).toBe(403);
  });

  it('requires a room: the copilot never reasons over caller-supplied evidence', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      headers: { 'x-test-user': 'alex' },
      payload: {
        topology: { nodes: [], edges: [] },
        hostName: 'Alex',
        transcriptSegments: [{ speakerName: 'Mallory', text: 'forged' }],
        experimentSummary: { completionRate: 1 },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('loads experiment evidence from the run store and 404s on unknown runs', async () => {
    let prompt = '';
    const model: StructuredModelPort = {
      generateStructured<T>(params: { messages: readonly { content: string }[] }) {
        prompt = params.messages[1]?.content ?? '';
        return Promise.resolve({
          data: {
            handRaised: false,
            spokenOpinion: '',
            identifiedRisk: '',
            supportingTranscriptReferences: [],
            affectedNodeIds: [],
            affectedEdgeIds: [],
            facts: [],
            assumptions: [],
            confidence: 0.5,
            hazards: [],
          } as unknown as T,
          rawOutput: '{}',
          metadata: { provider: 'meta', modelId: 'm', promptVersion: 'v1', latencyMs: 1 },
        });
      },
    };
    const withRuns = setup({
      model,
      loadExperimentEvidence: (runId) =>
        runId === 'run-real' ? { completionRate: 0.42, verdicts: [{ status: 'VIOLATED' }] } : null,
    });
    withRuns.rooms.admit(ALEX.userId, 'room-r');
    const topology = {
      schemaVersion: 1,
      id: 't',
      name: 'T',
      source: 'scenario',
      entry: { nodeId: 'a' },
      nodes: [
        {
          id: 'a',
          label: 'a',
          kind: 'service',
          processing: { distribution: 'constant', ms: 1 },
          concurrency: { maxWorkers: 1 },
          queue: { mode: 'bounded', maxDepth: 1 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    };
    const unknown = await withRuns.app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      headers: { 'x-test-user': 'alex' },
      payload: { topology, hostName: 'Alex', roomId: 'room-r', runId: 'run-missing' },
    });
    expect(unknown.statusCode).toBe(404);
    const known = await withRuns.app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      headers: { 'x-test-user': 'alex' },
      payload: { topology, hostName: 'Alex', roomId: 'room-r', runId: 'run-real' },
    });
    expect(known.statusCode).toBe(200);
    expect(prompt).toContain('0.42');
  });
});
