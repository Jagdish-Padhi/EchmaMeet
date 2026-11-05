import { z } from 'zod';
import { comparatorSchema, invariantMetricSchema } from '../chaos/invariant';
import { scenarioIdSchema } from '../common/ids';

export const voiceFaultParametersSchema = z.object({
  latencyMs: z.number().int().min(0).max(60_000).optional(),
  jitterMs: z.number().int().min(0).max(10_000).optional(),
  holdMs: z.number().int().min(0).max(60_000).nullable().optional(),
  resetAfterMs: z.number().int().min(0).max(60_000).optional(),
  toxicity: z.number().min(0).max(1).optional(),
});
export type VoiceFaultParameters = z.infer<typeof voiceFaultParametersSchema>;

export const voiceCommandSchema = z.discriminatedUnion('command', [
  z.object({
    command: z.literal('inject_fault'),
    source: z.string().min(1),
    target: z.string().min(1),
    faultType: z.enum(['latency', 'stall', 'connection_reset', 'dependency_down']),
    parameters: voiceFaultParametersSchema.optional(),
  }),
  z.object({
    command: z.literal('set_invariant'),
    metric: invariantMetricSchema,
    comparator: comparatorSchema,
    threshold: z.number(),
  }),
  z.object({
    command: z.literal('run_experiment'),
    trials: z.number().int().min(1).max(20).optional(),
    durationMs: z.number().int().min(500).max(60_000).optional(),
  }),
  z.object({
    command: z.literal('start_repair'),
    proposer: z.enum(['model', 'rule_based']),
    maxIterations: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    command: z.literal('cancel'),
  }),
  z.object({
    command: z.literal('load_scenario'),
    scenarioId: scenarioIdSchema,
  }),
]);
export type VoiceCommand = z.infer<typeof voiceCommandSchema>;

export const voiceTimingsSchema = z.object({
  captureMs: z.number().int().min(0),
  transcriptMs: z.number().int().min(0),
  parseMs: z.number().int().min(0),
});
export type VoiceTimings = z.infer<typeof voiceTimingsSchema>;

export const voiceIntentParseResultSchema = z.object({
  transcript: z.string(),
  timings: voiceTimingsSchema,
  status: z.enum(['parsed', 'ambiguous', 'unsupported', 'empty']),
  command: voiceCommandSchema.optional(),
  plainTextConfirmation: z.string().optional(),
  message: z.string().optional(),
  candidates: z.array(z.string()).optional(),
});
export type VoiceIntentParseResult = z.infer<typeof voiceIntentParseResultSchema>;

export const voiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('audio_chunk'),
    data: z.string(), // base64 encoded audio bytes
  }),
  z.object({
    type: z.literal('end_utterance'),
    audioDurationMs: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('parse_intent'),
    transcript: z.string().min(1),
    audioDurationMs: z.number().int().min(0).default(0),
  }),
]);
export type VoiceClientMessage = z.infer<typeof voiceClientMessageSchema>;

export const voiceServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('transcript_partial'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('transcript_final'),
    text: z.string(),
    latencyMs: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('intent_parsed'),
    result: voiceIntentParseResultSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);
export type VoiceServerMessage = z.infer<typeof voiceServerMessageSchema>;
