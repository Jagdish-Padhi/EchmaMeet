import { z } from 'zod';
import type { StructuredModelPort } from '../meta-ai';
import type { Topology } from '@chaosboard/contracts';
import { ECHMA_MEETING_AGENT_SYSTEM_PROMPT } from './prompts';

export const meetingAiRequestSchema = z.strictObject({
  topology: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    entryNodeId: z.string().optional().nullable(),
  }),
  hostName: z.string().default('Engineer'),
  userPrompt: z.string().optional().nullable(),
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

export const meetingAiResponseSchema = z.object({
  handRaised: z.boolean().optional().default(false),
  spokenOpinion: z.string(),
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

export class MeetingAgentService {
  constructor(private readonly model: StructuredModelPort) {}

  async evaluateMeetingContext(
    topology: Topology,
    hostName: string,
    userPrompt?: string | null,
    signal?: AbortSignal,
  ): Promise<MeetingAiResponse> {
    const nodeCount = topology.nodes.length;

    // Fast-path: When canvas is completely empty, don't burn tokens on complex reasoning.
    // Return naturally tailored greeting to the engineer host.
    if (nodeCount === 0) {
      const cleanHost = hostName?.trim() || 'team';
      return {
        handRaised: false,
        spokenOpinion: `Hey ${cleanHost}, you haven't drawn any services on the canvas yet. What system architecture are we designing today?`,
        hazards: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // Prepare dense, cost-optimized topology summary for Llama 3
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
      hostName,
      meetingQuestion: userPrompt || 'What is your review of our current architecture topology?',
      topology: topologySummary,
    });

    const llmResult = await this.model.generateStructured({
      messages: [
        { role: 'system', content: ECHMA_MEETING_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      responseSchema: z.object({
        handRaised: z.boolean().optional().default(false),
        spokenOpinion: z.string(),
        hazards: z.array(sreHazardSchema).optional().default([]),
      }).passthrough(),
      temperature: 0.1,
      maxTokens: 800,
      signal,
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

