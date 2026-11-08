import {
  scenarioIdSchema,
  type VoiceCommand,
  type VoiceIntentParseResult,
} from '@chaosboard/contracts';
import { hasAny, LEXICON, normalizeSpeech } from './lexicon';
import {
  resolveEdgeFromSpokenText,
  type TopologyEdgeRef,
  type TopologyNodeRef,
} from './name-resolution';
import { replies, replyLanguageFor } from './replies';

export interface ParseIntentOptions {
  readonly captureMs?: number | undefined;
  readonly transcriptMs?: number | undefined;
  readonly parseMs?: number | undefined;
  /** BCP-47 tag reported by the speech-to-text model (hi-IN, en-IN, ...). */
  readonly language?: string | undefined;
}

type InvariantMetric = Extract<VoiceCommand, { command: 'set_invariant' }>['metric'];

const SCENARIOS: readonly { readonly id: string; readonly terms: readonly string[] }[] = [
  { id: 'retry-storm', terms: ['retry storm', 'रिट्राई स्टॉर्म'] },
  { id: 'missing-timeout-cascade', terms: ['missing timeout', 'cascade', 'टाइमआउट'] },
  { id: 'unbounded-queue', terms: ['unbounded queue', 'अनबाउंडेड'] },
  { id: 'non-idempotent-retry', terms: ['non-idempotent', 'duplicate', 'डुप्लिकेट'] },
  { id: 'oversensitive-breaker', terms: ['circuit breaker', 'oversensitive', 'सर्किट ब्रेकर'] },
  { id: 'availability-tradeoff', terms: ['trade-off', 'tradeoff', 'availability', 'अवेलेबिलिटी'] },
];

function firstNumber(text: string, unitTerms: readonly string[]): number | undefined {
  const unitPattern = unitTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})`, 'u').exec(text);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/**
 * Pure deterministic intent parser that turns a transcript (English, Hindi or Hinglish) into a
 * strictly-typed VoiceCommand. It never guesses: ambiguity and unsupported requests are
 * surfaced explicitly, and nothing here can produce free-form code.
 */
export function parseVoiceIntent(
  rawTranscript: string,
  edges: readonly TopologyEdgeRef[],
  nodes: readonly TopologyNodeRef[],
  options?: ParseIntentOptions,
): VoiceIntentParseResult {
  const transcript = rawTranscript.trim();
  const normalized = normalizeSpeech(transcript);
  const lower = normalized.toLowerCase();
  const lang = replyLanguageFor(options?.language, transcript);

  const timings = {
    captureMs: options?.captureMs ?? 1000,
    transcriptMs: options?.transcriptMs ?? 250,
    parseMs: options?.parseMs ?? 1,
  };

  const finish = (
    result: Omit<VoiceIntentParseResult, 'transcript' | 'timings' | 'language'>,
  ): VoiceIntentParseResult => ({
    transcript,
    timings,
    ...(options?.language ? { language: options.language } : {}),
    ...result,
  });

  if (transcript.length === 0) {
    return finish({
      status: 'empty',
      message: 'Transcript is empty. Please speak a command.',
      spokenReply: replies.empty(lang),
    });
  }

  // 1. Cancel
  if (hasAny(lower, LEXICON.cancel)) {
    return finish({
      status: 'parsed',
      command: { command: 'cancel' },
      plainTextConfirmation: 'Cancel active experiment or repair run',
      spokenReply: replies.cancel(lang),
    });
  }

  const wantsStart = hasAny(lower, LEXICON.startVerb);

  // 2. Run experiment
  const experimentPhrase =
    lower.includes('run experiment') ||
    lower.includes('start experiment') ||
    lower.includes('test resilience') ||
    (hasAny(lower, LEXICON.experimentNoun) && wantsStart && !hasAny(lower, LEXICON.repairNoun));
  if (experimentPhrase) {
    let trials = 5;
    const requested = firstNumber(lower, LEXICON.trials);
    if (
      requested !== undefined &&
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= 20
    ) {
      trials = requested;
    }
    return finish({
      status: 'parsed',
      command: { command: 'run_experiment', trials, durationMs: 5000 },
      plainTextConfirmation: `Start chaos experiment (${String(trials)} trials, 5000ms measurement)`,
      spokenReply: replies.experiment(lang, trials),
    });
  }

  // 3. Start repair
  const repairPhrase =
    lower.includes('start repair') ||
    lower.includes('run repair') ||
    lower.includes('autonomous repair') ||
    (hasAny(lower, LEXICON.repairNoun) && wantsStart);
  if (repairPhrase) {
    const ruleBased = hasAny(lower, LEXICON.ruleBased);
    return finish({
      status: 'parsed',
      command: {
        command: 'start_repair',
        proposer: ruleBased ? 'rule_based' : 'model',
        maxIterations: 3,
      },
      plainTextConfirmation: `Start autonomous repair loop with ${ruleBased ? 'rule-based' : 'model'} proposer (max 3 iterations)`,
      spokenReply: replies.repair(lang, ruleBased),
    });
  }

  // 4. Load scenario
  if (hasAny(lower, LEXICON.scenario)) {
    let rawId = 'retry-storm';
    const numbered =
      /(?:scenario|सीनेरियो|परिदृश्य|senario)\s*(?:number|नंबर|no\.?)?\s*([1-6])\b/u.exec(lower);
    const byIndex = numbered?.[1] === undefined ? undefined : SCENARIOS[Number(numbered[1]) - 1];
    const byName = SCENARIOS.find((s) => hasAny(lower, s.terms));
    rawId = (byIndex ?? byName)?.id ?? rawId;
    const scenarioId = scenarioIdSchema.parse(rawId);
    return finish({
      status: 'parsed',
      command: { command: 'load_scenario', scenarioId },
      plainTextConfirmation: `Load scenario "${scenarioId}" into active canvas`,
      spokenReply: replies.scenario(lang, scenarioId),
    });
  }

  // 5. Invariant
  if (hasAny(lower, LEXICON.invariant)) {
    let metric: InvariantMetric = 'e2e_p99_ms';
    let comparator: 'lt' | 'lte' | 'gt' | 'gte' = 'lt';
    let threshold = 500;
    if (hasAny(lower, LEXICON.errorRate)) {
      metric = 'e2e_error_rate';
      threshold = 0.05;
    } else if (hasAny(lower, LEXICON.completionRate)) {
      metric = 'completion_rate';
      threshold = 0.95;
      comparator = 'gte';
    } else if (hasAny(lower, LEXICON.retryAmplification)) {
      metric = 'retry_amplification';
      threshold = 1.5;
    }
    const num = /(\d+(?:\.\d+)?)/.exec(lower);
    if (num?.[1] !== undefined && Number.isFinite(Number(num[1]))) threshold = Number(num[1]);
    return finish({
      status: 'parsed',
      command: { command: 'set_invariant', metric, comparator, threshold },
      plainTextConfirmation: `Set invariant: ${metric} ${comparator} ${String(threshold)}`,
      spokenReply: replies.invariant(lang, metric, comparator, threshold),
    });
  }

  // 6. Fault injection
  if (hasAny(lower, LEXICON.fault)) {
    const edgeMatch = resolveEdgeFromSpokenText(normalized, edges, nodes);
    if (edgeMatch.status === 'ambiguous') {
      return finish({
        status: 'ambiguous',
        candidates: edgeMatch.candidates.map((c) => c.id),
        message: edgeMatch.message ?? 'Multiple target edges match spoken command.',
        spokenReply: replies.ambiguous(lang),
      });
    }
    if (edgeMatch.status === 'none' || !edgeMatch.edge) {
      return finish({
        status: 'unsupported',
        message: 'Could not resolve target edge for fault injection in active topology.',
        spokenReply: replies.noEdge(lang),
      });
    }

    let faultType: 'latency' | 'stall' | 'connection_reset' | 'dependency_down' = 'latency';
    if (hasAny(lower, LEXICON.stall)) faultType = 'stall';
    else if (hasAny(lower, LEXICON.reset)) faultType = 'connection_reset';
    else if (hasAny(lower, LEXICON.down)) faultType = 'dependency_down';

    let latencyMs = 300;
    const ms = firstNumber(lower, LEXICON.milliseconds);
    const sec = firstNumber(lower, LEXICON.seconds);
    const requested = ms ?? (sec === undefined ? undefined : sec * 1000);
    if (
      requested !== undefined &&
      Number.isInteger(requested) &&
      requested > 0 &&
      requested <= 60_000
    ) {
      latencyMs = requested;
    }

    const { source, target } = edgeMatch.edge;
    return finish({
      status: 'parsed',
      command: {
        command: 'inject_fault',
        source,
        target,
        faultType,
        parameters: {
          ...(faultType === 'latency' ? { latencyMs, jitterMs: 50 } : {}),
          ...(faultType === 'stall' ? { holdMs: 500 } : {}),
          ...(faultType === 'connection_reset' ? { resetAfterMs: 100 } : {}),
        },
      },
      plainTextConfirmation: `Inject ${faultType} fault on link ${source} -> ${target}${faultType === 'latency' ? ` (${String(latencyMs)}ms)` : ''}`,
      spokenReply: replies.fault(
        lang,
        source,
        target,
        faultType,
        faultType === 'latency' ? latencyMs : undefined,
      ),
    });
  }

  return finish({
    status: 'unsupported',
    message: `Unsupported command: "${transcript}". Valid commands include: inject fault, run experiment, start repair, set invariant, cancel, or load scenario.`,
    spokenReply: replies.unsupported(lang),
  });
}
