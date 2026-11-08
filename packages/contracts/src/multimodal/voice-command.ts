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
  /** BCP-47 tag of the language the speaker used (en-IN, hi-IN, ...). */
  language: z.string().optional(),
  /** Localised confirmation in the speaker's language, suitable for text-to-speech. */
  spokenReply: z.string().optional(),
  /** Present when the request asked for a spoken reply and Gnani Timbre produced one. */
  speech: z
    .object({
      audioBase64: z.string(),
      contentType: z.string(),
      voice: z.string(),
      latencyMs: z.number().int().min(0),
    })
    .nullable()
    .optional(),
});
export type VoiceIntentParseResult = z.infer<typeof voiceIntentParseResultSchema>;

export const voiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    /** `indic-auto` or 1-4 comma-separated codes such as `hi-IN,en-IN`. */
    language: z.string().max(40).default('indic-auto'),
    sampleRate: z.union([z.literal(8000), z.literal(16000)]).default(16000),
    /** Speak the confirmation back with Gnani Timbre text-to-speech. */
    speakReplies: z.boolean().default(true),
    nodes: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .max(200)
      .default([]),
    edges: z
      .array(z.object({ id: z.string(), source: z.string(), target: z.string() }))
      .max(400)
      .default([]),
  }),
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
    type: z.literal('ready'),
    sttModel: z.string(),
    language: z.string(),
  }),
  z.object({
    type: z.literal('transcript_final'),
    text: z.string(),
    latencyMs: z.number().int().min(0),
    language: z.string().optional(),
  }),
  z.object({
    type: z.literal('speech_reply'),
    text: z.string(),
    language: z.string(),
    voice: z.string(),
    contentType: z.string(),
    /** base64 WAV from Gnani Timbre. */
    audioBase64: z.string(),
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
