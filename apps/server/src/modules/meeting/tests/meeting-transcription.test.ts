import { describe, it, expect } from 'vitest';
import fastify from 'fastify';
import { registerMeetingRoutes } from '../routes';
import { MeetingAgentService } from '../meeting-agent-service';
import { globalTranscriptStore } from '../transcript-store';
import type { StructuredModelPort } from '../../reasoning';
import type { Topology } from '@chaosboard/contracts';

describe('Meeting Transcription & Grounded Echma SRE AI Reasoning (Tasks 5 & 6)', () => {
  function createTestServer(customModel?: StructuredModelPort) {
    const app = fastify();
    app.addHook('onRequest', async (req) => {
      (req as unknown as { user: { userId: string; name: string } }).user = {
        userId: 'eng-alex-chen',
        name: 'Alex Chen',
      };
    });
    const mockModel: StructuredModelPort = customModel ?? {
      async generateStructured<T>() {
        return {
          data: {
            handRaised: true,
            spokenOpinion:
              'The checkout service makes un-jittered retries to the inventory worker.',
            identifiedRisk: 'Cascading retry storm under database delay.',
            supportingTranscriptReferences: [
              {
                speaker: 'Alex',
                timestampMs: 1600000000000,
                quote: 'We saw high latency on inventory yesterday.',
              },
            ],
            affectedNodeIds: ['checkout', 'inventory'],
            affectedEdgeIds: ['checkout-to-inventory'],
            facts: ['Checkout retry policy has maxAttempts: 3 and jitter: none.'],
            assumptions: ['Inventory latency will exceed 500ms during peak load.'],
            confidence: 0.92,
            proposedExperiment: {
              faultType: 'latency',
              targetEdgeId: 'checkout-to-inventory',
              expectedOutcome: 'Thread pool exhaustion on checkout within 10 seconds.',
              verificationConditions: ['p99LatencyMs > 1500', 'completionRate < 0.5'],
            },
            hazards: [
              {
                id: 'haz-1',
                title: 'Unjittered Retry Storm',
                severity: 'high',
                risk: 'Cascading retry storm under downstream slowness.',
                recommendation: 'Apply full jitter and circuit breaking.',
                targetEdgeId: 'checkout-to-inventory',
              },
            ],
          } as unknown as T,
          rawOutput: '{}',
          metadata: {
            provider: 'evon',
            modelId: 'gnani-evon-v3.3',
            promptVersion: 'v1',
            latencyMs: 120,
            tokenCounts: { promptTokens: 350, completionTokens: 120 },
          },
        };
      },
    };

    const meetingService = new MeetingAgentService(mockModel);
    registerMeetingRoutes(app, meetingService);
    return { app, meetingService, mockModel };
  }

  it('rejects transcription chunk with 403 when recording consent is false', async () => {
    const { app } = createTestServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/rooms/room-privacy/transcript',
      payload: {
        chunkId: 'chunk-1',
        audioBase64: Buffer.from('dummy-audio-bytes-for-test').toString('base64'),
        speakerId: 'user-alice',
        speakerName: 'Alice',
        timestampMs: Date.now(),
        recordingConsent: false, // Explicitly no consent!
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.title).toBe('Recording Consent Required');
  });

  it('persists transcript segments and avoids duplicates after retries', async () => {
    const { app } = createTestServer();
    globalTranscriptStore.clearSegments('room-test-persistence');

    // Simulate whisper transcription by adding segments directly or via endpoint
    globalTranscriptStore.addSegment({
      id: 'chunk-persistent-1',
      roomId: 'room-test-persistence',
      speakerId: 'user-alex',
      speakerName: 'Alex Chen',
      text: 'Notice that the payment service is stalling downstream calls.',
      timestampMs: 1700000001000,
      durationMs: 4000,
    });

    globalTranscriptStore.addSegment({
      id: 'chunk-persistent-2',
      roomId: 'room-test-persistence',
      speakerId: 'user-bob',
      speakerName: 'Bob',
      text: 'Yes, and retries are set to 5 without backoff.',
      timestampMs: 1700000005000,
      durationMs: 4000,
    });

    // Attempt to add duplicate chunk-persistent-1 (e.g. retry from network timeout)
    const duplicateAdded = globalTranscriptStore.addSegment({
      id: 'chunk-persistent-1',
      roomId: 'room-test-persistence',
      speakerId: 'user-alex',
      speakerName: 'Alex Chen',
      text: 'Notice that the payment service is stalling downstream calls.',
      timestampMs: 1700000001000,
      durationMs: 4000,
    });
    expect(duplicateAdded).toBe(false);

    // Fetch persisted transcripts via API
    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms/room-test-persistence/transcripts',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.roomId).toBe('room-test-persistence');
    expect(body.segments).toHaveLength(2);
    expect(body.segments[0].speakerName).toBe('Alex Chen');
    expect(body.segments[1].speakerName).toBe('Bob');
  });

  it('grounds Echma SRE agent reasoning in transcripts, facts vs assumptions, and proposed experiments', async () => {
    let capturedUserContent: any = null;
    const mockModel: StructuredModelPort = {
      async generateStructured<T>(params: any) {
        capturedUserContent = JSON.parse(params.messages[1]?.content as string);
        return {
          data: {
            handRaised: true,
            spokenOpinion:
              'Alex mentioned inventory latency, and looking at the graph checkout will collapse.',
            identifiedRisk: 'Cascading retry storm under database delay.',
            supportingTranscriptReferences: [
              {
                speaker: 'Alex Chen',
                timestampMs: 1700000001000,
                quote: 'Notice that the payment service is stalling downstream calls.',
              },
            ],
            affectedNodeIds: ['checkout'],
            affectedEdgeIds: ['checkout-to-inventory'],
            facts: ['Checkout retry policy has maxAttempts: 3.'],
            assumptions: ['Inventory latency will spike above timeout.'],
            confidence: 0.95,
            proposedExperiment: {
              faultType: 'latency',
              targetEdgeId: 'checkout-to-inventory',
              expectedOutcome: 'Thread exhaustion.',
              verificationConditions: ['completionRate < 0.5'],
            },
            hazards: [],
          } as unknown as T,
          rawOutput: '{}',
          metadata: {
            provider: 'evon',
            modelId: 'gnani-evon-v3.3',
            promptVersion: 'v1',
            latencyMs: 120,
          },
        };
      },
    };

    const { app } = createTestServer(mockModel);

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

    const response = await app.inject({
      method: 'POST',
      url: '/api/meeting/ai-opinion',
      payload: {
        topology: testTopology,
        hostName: 'Alex Chen',
        roomId: 'room-grounded-test',
        transcriptSegments: [
          {
            speakerName: 'Alex Chen',
            text: 'Notice that the payment service is stalling downstream calls.',
          },
        ],
        experimentSummary: { completionRate: 0.85, p99LatencyMs: 340 },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    // Verify context was passed to model
    expect(capturedUserContent).toBeDefined();
    expect(capturedUserContent.liveMeetingTranscripts).toContain(
      'Alex Chen: "Notice that the payment service is stalling',
    );
    expect(capturedUserContent.experimentMeasurements.completionRate).toBe(0.85);

    // Verify structured output properties
    expect(body.handRaised).toBe(true);
    expect(body.confidence).toBe(0.95);
    expect(body.supportingTranscriptReferences).toHaveLength(1);
    expect(body.supportingTranscriptReferences[0].speaker).toBe('Alex Chen');
    expect(body.facts).toContain('Checkout retry policy has maxAttempts: 3.');
    expect(body.proposedExperiment.faultType).toBe('latency');
  });
});
