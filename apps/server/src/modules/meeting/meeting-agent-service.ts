import { z } from 'zod';
import type { StructuredModelPort } from '../reasoning';
import type { Topology } from '@chaosboard/contracts';
import { ECHMA_MEETING_AGENT_SYSTEM_PROMPT } from './prompts';
import { globalTranscriptStore } from './transcript-store';
import { composeSpokenOpinion, detectHazards } from './domain/hazard-rules';

export const meetingAiRequestSchema = z.object({
  topology: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    entryNodeId: z.string().optional().nullable(),
  }),
  hostName: z.string().default('Engineer'),
  language: z.string().max(40).optional().nullable(),
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

const sreHazardObjectSchema = z.looseObject({
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
      mode: z.enum(['sync_call', 'async_enqueue']).optional(),
      queue: z
        .object({
          mode: z.enum(['bounded', 'unbounded']),
          maxDepth: z.number().int().optional(),
        })
        .optional(),
      concurrency: z
        .object({
          maxWorkers: z.number().int().optional(),
        })
        .optional(),
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

export const sreHazardSchema = z.union([
  z.string().transform((str) => ({
    id: `hazard-${Math.random().toString(36).slice(2, 7)}`,
    title: str,
    severity: 'high' as const,
    risk: str,
    recommendation: 'Configure exponential jitter backoff and circuit breaking.',
  })),
  sreHazardObjectSchema,
]);

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
  /** BCP-47 tag (hi-IN, en-IN, ...) used to pick the language of the spoken opinion. */
  language?: string | null | undefined;
  userPrompt?: string | null | undefined;
  roomId?: string | null | undefined;
  transcriptSegments?:
    readonly { speakerName: string; text: string; timestampMs?: number | undefined }[] | undefined;
  experimentSummary?:
    | {
        completionRate?: number | undefined;
        p99LatencyMs?: number | undefined;
        verdicts?: readonly unknown[] | undefined;
      }
    | undefined;
  signal?: AbortSignal | undefined;
}

export class MeetingAgentService {
  constructor(private readonly model?: StructuredModelPort | undefined) {}

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
    const transcripts =
      opts.transcriptSegments ??
      (opts.roomId ? globalTranscriptStore.getSegments(opts.roomId) : []);

    const recentTranscriptText = transcripts
      .slice(-10)
      .map((t) => `${t.speakerName}: "${t.text}"`)
      .join('\n');

    // Prepare dense, grounded architecture context for the optional language model
    const topologySummary = {
      nodes: topology.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        queue: n.queue,
        concurrency: (n as { concurrency?: unknown }).concurrency,
        processing: (n as { processing?: unknown }).processing,
      })),
      edges: topology.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        mode: (e as { mode?: string }).mode ?? 'sync_call',
        policy: e.policy,
      })),
    };

    const rules = detectHazards(topology);

    const userContent = JSON.stringify({
      hostName: opts.hostName,
      meetingQuestion:
        opts.userPrompt || 'What is your review of our current architecture topology?',
      topology: topologySummary,
      detectedGroundTruthHazards: rules.map((r) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        risk: r.risk,
        recommendation: r.recommendation,
        targetEdgeId: r.targetEdgeId,
        targetNodeId: r.targetNodeId,
      })),
      liveMeetingTranscripts: recentTranscriptText || 'No verbal discussion recorded yet.',
      experimentMeasurements: opts.experimentSummary ?? 'No active chaos trial executed yet.',
    });

    const speakHindi = (opts.language ?? '').startsWith('hi');
    const deterministic = (): MeetingAiResponse => ({
      handRaised: rules.some((h) => h.severity === 'high' || h.severity === 'critical'),
      spokenOpinion: composeSpokenOpinion(rules, speakHindi ? 'hi' : 'en', nodeCount),
      identifiedRisk: rules[0]?.risk,
      supportingTranscriptReferences: [],
      affectedNodeIds: rules.map((h) => h.targetNodeId).filter((id): id is string => Boolean(id)),
      affectedEdgeIds: rules.map((h) => h.targetEdgeId).filter((id): id is string => Boolean(id)),
      facts: [
        `Topology has ${String(nodeCount)} services and ${String(topology.edges.length)} connections.`,
      ],
      assumptions: [],
      confidence: 0.9,
      hazards: rules.map((h) => ({
        id: h.id,
        title: h.title,
        severity: h.severity,
        risk: h.risk,
        recommendation: h.recommendation,
        targetNodeId: h.targetNodeId,
        targetEdgeId: h.targetEdgeId,
        patch: h.patch,
      })),
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
    if (!this.model) return deterministic();

    let llmResult: Awaited<ReturnType<StructuredModelPort['generateStructured']>> & {
      readonly data: MeetingAiResponse;
    };
    try {
      llmResult = await this.model.generateStructured<MeetingAiResponse>({
        messages: [
          { role: 'system', content: ECHMA_MEETING_AGENT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        responseSchema: meetingAiResponseSchema,
        temperature: 0.1,
        maxTokens: 1000,
        signal: opts.signal,
      });
    } catch (err) {
      // If structured parsing failed, check if the raw output was plain text containing an opinion
      const rawText =
        typeof err === 'object' && err !== null && 'details' in err
          ? err.details
          : undefined;
      if (typeof rawText === 'string' && rawText.trim().length > 20) {
        const cleaned = rawText
          .replace(/```(?:json)?/g, '')
          .replace(/handRaised:\s*(?:true|false)/gi, '')
          .trim();
        return {
          handRaised: /handRaised:\s*true/i.test(rawText),
          spokenOpinion: cleaned,
          hazards: [],
          facts: [`Topology has ${String(nodeCount)} services.`],
          assumptions: [],
          confidence: 0.85,
          supportingTranscriptReferences: [],
          affectedNodeIds: [],
          affectedEdgeIds: [],
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
      return deterministic();
    }

    // Grounded transcript verification: filter out fabricated transcript quotes that do not appear in actual transcript
    const rawQuotes = llmResult.data.supportingTranscriptReferences;
    const groundedReferences = rawQuotes.filter((ref) => {
      if (!recentTranscriptText || recentTranscriptText.trim().length === 0) return false;
      const lowerTranscript = recentTranscriptText.toLowerCase();
      const lowerQuote = ref.quote.toLowerCase().trim();
      if (lowerTranscript.includes(lowerQuote)) return true;
      // Check significant words (length > 3)
      const words = lowerQuote.split(/\s+/).filter((w) => w.length > 3);
      return words.length > 0 && words.some((w) => lowerTranscript.includes(w));
    });

    const parsedHazards = llmResult.data.hazards.map((item) => {
      const h = item as Record<string, any>;
      const edge = h.targetEdgeId
        ? topology.edges.find((e) => e.id === h.targetEdgeId)
        : topology.edges.find(
            (e) =>
              (h.risk && (h.risk.includes(e.source) || h.risk.includes(e.target))) ||
              (h.title && (h.title.includes(e.source) || h.title.includes(e.target))),
          );
      const edgeId = h.targetEdgeId || edge?.id;

      const matchedRule = rules.find(
        (r) =>
          (edgeId && r.targetEdgeId === edgeId) ||
          (h.targetNodeId && r.targetNodeId === h.targetNodeId) ||
          r.title.toLowerCase().includes((h.title || '').toLowerCase()),
      );

      let patch = h.patch || matchedRule?.patch;
      if (!patch && edge) {
        if (edge.policy.timeoutMs === null || edge.policy.timeoutMs > 2000) {
          patch = { timeoutMs: 500 };
        } else if (edge.policy.retry.maxAttempts >= 2 && !edge.policy.breaker.enabled) {
          patch = {
            retry: { maxAttempts: 2, jitter: 'full', backoffBaseMs: 50 },
            breaker: { enabled: true, failureThresholdPct: 50, cooldownMs: 2000 },
          };
        }
      }

      return {
        id: h.id || `hazard-${Math.random().toString(36).slice(2, 7)}`,
        title: h.title || h.issue || matchedRule?.title || 'Identified Hazard',
        severity: h.severity,
        risk: h.risk || h.issue || matchedRule?.risk || 'Resilience hazard identified.',
        recommendation:
          h.recommendation || matchedRule?.recommendation || 'Tune resilience policy parameters.',
        targetNodeId: h.targetNodeId || h.nodeId || matchedRule?.targetNodeId,
        targetEdgeId: edgeId,
        patch,
      };
    });

    // Merge any critical or high deterministic rule hazards that the LLM may have omitted
    const combinedHazards = [...parsedHazards];
    for (const rule of rules) {
      if (
        (rule.severity === 'high' || rule.severity === 'critical') &&
        !combinedHazards.some(
          (h) =>
            (h.targetEdgeId && h.targetEdgeId === rule.targetEdgeId) ||
            (h.targetNodeId && h.targetNodeId === rule.targetNodeId),
        )
      ) {
        combinedHazards.push({
          id: rule.id,
          title: rule.title,
          severity: rule.severity,
          risk: rule.risk,
          recommendation: rule.recommendation,
          targetNodeId: rule.targetNodeId,
          targetEdgeId: rule.targetEdgeId,
          patch: rule.patch,
        });
      }
    }

    return {
      handRaised: llmResult.data.handRaised || combinedHazards.length > 0,
      spokenOpinion: llmResult.data.spokenOpinion,
      identifiedRisk: llmResult.data.identifiedRisk ?? (combinedHazards[0]?.risk || undefined),
      supportingTranscriptReferences: groundedReferences,
      affectedNodeIds:
        llmResult.data.affectedNodeIds.length > 0
          ? llmResult.data.affectedNodeIds
          : combinedHazards.map((h) => h.targetNodeId).filter((id): id is string => Boolean(id)),
      affectedEdgeIds:
        llmResult.data.affectedEdgeIds.length > 0
          ? llmResult.data.affectedEdgeIds
          : combinedHazards.map((h) => h.targetEdgeId).filter((id): id is string => Boolean(id)),
      facts:
        llmResult.data.facts.length > 0
          ? llmResult.data.facts
          : [`Topology has ${nodeCount} services and ${topology.edges.length} connections.`],
      assumptions: llmResult.data.assumptions,
      confidence: llmResult.data.confidence ?? (groundedReferences.length > 0 ? 0.8 : 0.6),
      proposedExperiment: llmResult.data.proposedExperiment,
      hazards: combinedHazards,
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
