import { z } from 'zod';
import type { StructuredModelPort } from '../meta-ai';
import type { Topology } from '@chaosboard/contracts';
import { ECHMA_MEETING_AGENT_SYSTEM_PROMPT } from './prompts';
import { globalTranscriptStore } from './transcript-store';

export const meetingAiRequestSchema = z.object({
  topology: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    entryNodeId: z.string().optional().nullable(),
  }),
  hostName: z.string().default('Engineer'),
  userPrompt: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  transcriptSegments: z
    .array(
      z.object({
        speakerName: z.string(),
        text: z.string(),
        timestampMs: z.number().optional(),
      }),
    )
    .optional(),
  experimentSummary: z
    .object({
      completionRate: z.number().optional(),
      p99LatencyMs: z.number().optional(),
      verdicts: z.array(z.any()).optional(),
    })
    .optional(),
});

export type MeetingAiRequest = z.infer<typeof meetingAiRequestSchema>;

export const sreHazardSchema = z.object({
  id: z.string().optional().default(() => `hazard-${Math.random().toString(36).slice(2, 7)}`),
  title: z.string().optional().default('Architectural Risk'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
  risk: z.string().optional().default('Distributed systems hazard detected under sustained load.'),
  recommendation: z.string().optional().default('Bound queue capacity and apply circuit breaking.'),
  targetNodeId: z.string().optional(),
  targetEdgeId: z.string().optional(),
  nodeId: z.string().optional(),
  issue: z.string().optional(),
  patch: z
    .object({
      retry: z
        .object({
          maxAttempts: z.number().int().optional(),
          jitter: z.enum(['none', 'full', 'equal']).optional(),
          backoffBaseMs: z.number().int().optional(),
          backoffMultiplier: z.number().optional(),
          maxBackoffMs: z.number().int().optional(),
        })
        .optional(),
      breaker: z
        .object({
          enabled: z.boolean().optional(),
          failureThresholdPct: z.number().optional(),
          windowRequests: z.number().int().optional(),
          cooldownMs: z.number().int().optional(),
          halfOpenProbes: z.number().int().optional(),
        })
        .optional(),
      timeoutMs: z.number().int().nullable().optional(),
      fallback: z.enum(['none', 'fail_fast_503', 'serve_stale']).optional(),
      idempotency: z.object({ sendKey: z.boolean() }).optional(),
    })
    .optional(),
}).passthrough();

export const supportingTranscriptReferenceSchema = z.object({
  speaker: z.string().optional(),
  timestampMs: z.number().optional(),
  quote: z.string(),
});

export const proposedExperimentSchema = z.object({
  faultType: z.string(),
  targetEdgeId: z.string().optional(),
  targetNodeId: z.string().optional(),
  expectedOutcome: z.string(),
  verificationConditions: z.array(z.string()).default([]),
});

export const meetingAiResponseSchema = z.object({
  handRaised: z.boolean().optional().default(false),
  spokenOpinion: z.string(),
  identifiedRisk: z.string().optional(),
  supportingTranscriptReferences: z
    .array(supportingTranscriptReferenceSchema)
    .optional()
    .default([]),
  affectedNodeIds: z.array(z.string()).optional().default([]),
  affectedEdgeIds: z.array(z.string()).optional().default([]),
  facts: z.array(z.string()).optional().default([]),
  assumptions: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.85),
  proposedExperiment: proposedExperimentSchema.optional(),
  hazards: z.array(sreHazardSchema).optional().default([]),
  remediation: z.any().optional(),
  tokenUsage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
}).passthrough();

export type MeetingAiResponse = z.infer<typeof meetingAiResponseSchema>;

export interface EvaluateMeetingOptions {
  topology: Topology;
  hostName: string;
  userPrompt?: string | null | undefined;
  roomId?: string | null | undefined;
  transcriptSegments?: readonly { speakerName: string; text: string; timestampMs?: number | undefined }[] | undefined;
  experimentSummary?: {
    completionRate?: number | undefined;
    p99LatencyMs?: number | undefined;
    verdicts?: readonly unknown[] | undefined;
  } | undefined;
  signal?: AbortSignal | undefined;
}

export class MeetingAgentService {
  constructor(private readonly model: StructuredModelPort) {}

  async evaluateMeetingContext(
    optionsOrTopology: EvaluateMeetingOptions | Topology,
    hostName = 'Engineer',
    userPrompt?: string | null,
    signal?: AbortSignal,
  ): Promise<MeetingAiResponse> {
    const opts: EvaluateMeetingOptions =
      'nodes' in optionsOrTopology
        ? {
            topology: optionsOrTopology,
            hostName,
            userPrompt,
            signal,
          }
        : optionsOrTopology;

    const topology = opts.topology;
    const nodeCount = topology.nodes.length;

    // Fast-path: When canvas is completely empty, don't burn tokens on complex reasoning.
    if (nodeCount === 0) {
      const cleanHost = opts.hostName?.trim() || 'team';
      return {
        handRaised: false,
        spokenOpinion: `Hey ${cleanHost}, you haven't drawn any services on the canvas yet. What system architecture are we designing today?`,
        hazards: [],
        facts: ['Canvas is currently empty.'],
        assumptions: [],
        confidence: 1.0,
        supportingTranscriptReferences: [],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // Resolve real transcript segments from room store if not provided
    const transcripts =
      opts.transcriptSegments ??
      (opts.roomId ? globalTranscriptStore.getSegments(opts.roomId) : []);

    const recentTranscriptText = transcripts
      .slice(-10)
      .map((t) => `${t.speakerName}: "${t.text}"`)
      .join('\n');

    // Prepare dense, grounded architecture context for Meta Llama 3
    const topologySummary = {
      nodes: topology.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        queue: n.queue,
      })),
      edges: topology.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        policy: e.policy,
      })),
    };

    const userContent = JSON.stringify({
      hostName: opts.hostName,
      meetingQuestion: opts.userPrompt || 'What is your review of our current architecture topology?',
      topology: topologySummary,
      liveMeetingTranscripts: recentTranscriptText || 'No verbal discussion recorded yet.',
      experimentMeasurements: opts.experimentSummary ?? 'No active chaos trial executed yet.',
    });

    const llmResult = await this.model.generateStructured({
      messages: [
        { role: 'system', content: ECHMA_MEETING_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      responseSchema: meetingAiResponseSchema,
      temperature: 0.1,
      maxTokens: 1000,
      signal: opts.signal,
    });

    const parsedHazards = (llmResult.data.hazards ?? []).map((h) => ({
      id: h.id || `hazard-${Math.random().toString(36).slice(2, 7)}`,
      title: h.title || h.issue || 'Architectural Risk',
      severity: h.severity || 'high',
      risk: h.risk || h.issue || 'Service vulnerability identified under sustained traffic.',
      recommendation: h.recommendation || 'Apply bounded queues and circuit breaking.',
      targetNodeId: h.targetNodeId || h.nodeId,
      targetEdgeId: h.targetEdgeId,
      patch: h.patch,
    }));

    return {
      handRaised: llmResult.data.handRaised || parsedHazards.length > 0,
      spokenOpinion: llmResult.data.spokenOpinion,
      identifiedRisk: llmResult.data.identifiedRisk ?? (parsedHazards[0]?.risk || undefined),
      supportingTranscriptReferences: llmResult.data.supportingTranscriptReferences ?? [],
      affectedNodeIds:
        (llmResult.data.affectedNodeIds ?? []).length > 0
          ? (llmResult.data.affectedNodeIds ?? [])
          : parsedHazards.map((h) => h.targetNodeId).filter((id): id is string => Boolean(id)),
      affectedEdgeIds:
        (llmResult.data.affectedEdgeIds ?? []).length > 0
          ? (llmResult.data.affectedEdgeIds ?? [])
          : parsedHazards.map((h) => h.targetEdgeId).filter((id): id is string => Boolean(id)),
      facts: (llmResult.data.facts ?? []).length > 0 ? (llmResult.data.facts ?? []) : [`Topology has ${nodeCount} services and ${topology.edges.length} connections.`],
      assumptions: llmResult.data.assumptions ?? [],
      confidence: llmResult.data.confidence ?? 0.85,
      proposedExperiment: llmResult.data.proposedExperiment,
      hazards: parsedHazards,
      tokenUsage: {
        promptTokens: llmResult.metadata.tokenCounts?.promptTokens,
        completionTokens: llmResult.metadata.tokenCounts?.completionTokens,
        totalTokens:
          (llmResult.metadata.tokenCounts?.promptTokens ?? 0) +
          (llmResult.metadata.tokenCounts?.completionTokens ?? 0),
      },
    };
  }
}

