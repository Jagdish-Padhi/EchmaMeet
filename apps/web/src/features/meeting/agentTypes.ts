import { z } from 'zod';

export const meetingHazardSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  risk: z.string(),
  recommendation: z.string(),
  targetNodeId: z.string().optional(),
  targetEdgeId: z.string().optional(),
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

export type MeetingHazard = z.infer<typeof meetingHazardSchema>;

export const meetingAiOpinionResponseSchema = z.strictObject({
  handRaised: z.boolean(),
  spokenOpinion: z.string(),
  hazards: z.array(meetingHazardSchema),
  tokenUsage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

export type MeetingAiOpinionResponse = z.infer<typeof meetingAiOpinionResponseSchema>;

export interface MeetingChatMessage {
  readonly id: string;
  readonly sender: string;
  readonly role?: string | undefined;
  readonly text: string;
  readonly timestamp: string;
  readonly isAi: boolean;
  readonly hazardBadge?:
    | {
        readonly severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
        readonly title: string;
        readonly recommendation?: string | undefined;
      }
    | undefined;
}
