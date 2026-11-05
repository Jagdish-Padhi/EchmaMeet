import { z } from 'zod';
import { isQuoteGrounded } from './quote-grounding';
import type { StructuredModelPort } from '../meta-ai';
import type { Topology } from '@chaosboard/contracts';
import { ECHMA_MEETING_AGENT_SYSTEM_PROMPT } from './prompts';

export const meetingAiRequestSchema = z.object({
  topology: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    entryNodeId: z.string().optional().nullable(),
  }),
  hostName: z.string().default('Engineer'),
  userPrompt: z.string().optional().nullable(),
  // The room is mandatory: all transcript and experiment evidence is retrieved server-side from it.
  roomId: z.string().min(1),
  // Optional pointer to a run the room discussed; its verdicts are loaded from the run store.
  runId: z.string().min(1).optional(),
});

export type MeetingAiRequest = z.infer<typeof meetingAiRequestSchema>;

export const sreHazardSchema = z.looseObject({
  id: z
    .string()
    .optional()
    .default(() => `hazard-${Math.random().toString(36).slice(2, 7)}`),
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
});

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

export const meetingAiResponseSchema = z.looseObject({
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
  confidence: z.number().min(0).max(1).optional(),
  proposedExperiment: proposedExperimentSchema.optional(),
  hazards: z.array(sreHazardSchema).optional().default([]),
  remediation: z.unknown().optional(),
  tokenUsage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

export type MeetingAiResponse = z.infer<typeof meetingAiResponseSchema>;

export interface EvaluateMeetingOptions {
  topology: Topology;
  hostName: string;
  userPrompt?: string | null | undefined;
  roomId?: string | null | undefined;
  transcriptSegments?:
    readonly { speakerName: string; text: string; timestampMs?: number | undefined }[] | undefined;
  experimentSummary?:
    | {
        completionRate?: number | null | undefined;
        p99LatencyMs?: number | null | undefined;
        verdicts?: readonly unknown[] | undefined;
      }
    | undefined;
  signal?: AbortSignal | undefined;
}

/** Model output is untrusted: tolerate omitted arrays even though the schema promises them. */
function orEmpty<T>(value: readonly T[] | null | undefined): T[] {
  return [...(value ?? [])];
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
      const cleanHost = opts.hostName.trim() || 'team';
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
    const transcripts = opts.transcriptSegments ?? [];

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
      meetingQuestion:
        opts.userPrompt || 'What is your review of our current architecture topology?',
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

    // Grounded transcript verification: filter out fabricated transcript quotes that do not appear in actual transcript
    const rawQuotes = orEmpty(llmResult.data.supportingTranscriptReferences);
    const groundedReferences = rawQuotes.filter((ref) =>
      isQuoteGrounded(ref.quote, ref.speaker ?? '', transcripts),
    );

    // Validate model output against real system state: a hazard that points at a node or edge
    // that does not exist is a hallucination and is dropped, not displayed.
    const knownNodeIds = new Set(topology.nodes.map((n) => n.id as string));
    const knownEdgeIds = new Set(topology.edges.map((e) => e.id as string));
    const referencesRealEntity = (h: {
      targetNodeId?: string | undefined;
      nodeId?: string | undefined;
      targetEdgeId?: string | undefined;
    }) => {
      const node = h.targetNodeId ?? h.nodeId;
      if (node !== undefined && !knownNodeIds.has(node)) return false;
      if (h.targetEdgeId !== undefined && !knownEdgeIds.has(h.targetEdgeId)) return false;
      return node !== undefined || h.targetEdgeId !== undefined;
    };

    const parsedHazards = orEmpty(llmResult.data.hazards)
      .filter(referencesRealEntity)
      .map((h) => ({
        id: h.id || `hazard-${Math.random().toString(36).slice(2, 7)}`,
        title: h.title || h.issue || 'Identified Hazard',
        severity: h.severity,
        risk: h.risk || h.issue || 'Resilience hazard identified.',
        recommendation: h.recommendation || 'Tune resilience policy parameters.',
        targetNodeId: h.targetNodeId || h.nodeId,
        targetEdgeId: h.targetEdgeId,
        patch: h.patch,
      }));

    return {
      handRaised: llmResult.data.handRaised || parsedHazards.length > 0,
      spokenOpinion: llmResult.data.spokenOpinion,
      identifiedRisk: llmResult.data.identifiedRisk ?? (parsedHazards[0]?.risk || undefined),
      supportingTranscriptReferences: groundedReferences,
      affectedNodeIds:
        orEmpty(llmResult.data.affectedNodeIds).filter((id) => knownNodeIds.has(id)).length > 0
          ? orEmpty(llmResult.data.affectedNodeIds).filter((id) => knownNodeIds.has(id))
          : parsedHazards.map((h) => h.targetNodeId).filter((id): id is string => Boolean(id)),
      affectedEdgeIds:
        orEmpty(llmResult.data.affectedEdgeIds).filter((id) => knownEdgeIds.has(id)).length > 0
          ? orEmpty(llmResult.data.affectedEdgeIds).filter((id) => knownEdgeIds.has(id))
          : parsedHazards.map((h) => h.targetEdgeId).filter((id): id is string => Boolean(id)),
      facts:
        orEmpty(llmResult.data.facts).length > 0
          ? orEmpty(llmResult.data.facts)
          : [`Topology has ${nodeCount} services and ${topology.edges.length} connections.`],
      assumptions: orEmpty(llmResult.data.assumptions),
      confidence: llmResult.data.confidence ?? (groundedReferences.length > 0 ? 0.8 : 0.6),
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
