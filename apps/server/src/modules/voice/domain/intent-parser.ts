import {
  scenarioIdSchema,
  type ScenarioId,
  type VoiceCommand,
  type VoiceIntentParseResult,
} from '@chaosboard/contracts';
import {
  resolveEdgeFromSpokenText,
  type TopologyEdgeRef,
  type TopologyNodeRef,
} from './name-resolution';

export interface ParseIntentOptions {
  readonly captureMs?: number | undefined;
  readonly transcriptMs?: number | undefined;
  readonly parseMs?: number | undefined;
}

/**
 * Pure deterministic domain intent parser that converts speech transcripts into strictly-typed VoiceCommands.
 * Follows hackathon charter: zero hallucinations, no free-form code execution, surfaces ambiguity explicitly.
 */
export function parseVoiceIntent(
  rawTranscript: string,
  edges: readonly TopologyEdgeRef[],
  nodes: readonly TopologyNodeRef[],
  options?: ParseIntentOptions,
): VoiceIntentParseResult {
  const transcript = rawTranscript.trim();
  const lower = transcript.toLowerCase();

  const timings = {
    captureMs: options?.captureMs ?? 1000,
    transcriptMs: options?.transcriptMs ?? 250,
    parseMs: options?.parseMs ?? 1,
  };

  const finish = (
    result: Omit<VoiceIntentParseResult, 'transcript' | 'timings'>,
  ): VoiceIntentParseResult => {
    return {
      transcript,
      timings,
      ...result,
    };
  };

  if (transcript.length === 0) {
    return finish({
      status: 'empty',
      message: 'Transcript is empty. Please speak a command.',
    });
  }

  // 1. Cancel / Abort
  if (lower.includes('cancel') || lower.includes('abort') || lower.includes('stop')) {
    const command: VoiceCommand = { command: 'cancel' };
    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: 'Cancel active experiment or repair run',
    });
  }

  // 2. Run experiment
  if (
    lower.includes('run experiment') ||
    lower.includes('start experiment') ||
    lower.includes('test resilience')
  ) {
    let trials = 5;
    const trialsMatch = /(\d+)\s*trials?/.exec(lower);
    if (trialsMatch && trialsMatch[1]) {
      const parsed = parseInt(trialsMatch[1], 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        trials = parsed;
      }
    }
    const command: VoiceCommand = {
      command: 'run_experiment',
      trials,
      durationMs: 5000,
    };
    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: `Start chaos experiment (${String(trials)} trials, 5000ms measurement)`,
    });
  }

  // 3. Start repair
  if (
    lower.includes('start repair') ||
    lower.includes('run repair') ||
    lower.includes('autonomous repair')
  ) {
    const isRuleBased = lower.includes('rule') || lower.includes('baseline');
    const command: VoiceCommand = {
      command: 'start_repair',
      proposer: isRuleBased ? 'rule_based' : 'model',
      maxIterations: 3,
    };
    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: `Start autonomous repair loop with ${isRuleBased ? 'rule-based' : 'Meta model'} proposer (max 3 iterations)`,
    });
  }

  // 4. Load scenario
  if (lower.includes('load scenario') || lower.includes('scenario')) {
    let rawId = 'retry-storm';
    if (lower.includes('1') || lower.includes('retry storm')) rawId = 'retry-storm';
    else if (lower.includes('2') || lower.includes('missing timeout') || lower.includes('cascade'))
      rawId = 'missing-timeout-cascade';
    else if (lower.includes('3') || lower.includes('unbounded queue')) rawId = 'unbounded-queue';
    else if (lower.includes('4') || lower.includes('non-idempotent') || lower.includes('duplicate'))
      rawId = 'non-idempotent-retry';
    else if (
      lower.includes('5') ||
      lower.includes('circuit breaker') ||
      lower.includes('oversensitive')
    )
      rawId = 'oversensitive-breaker';
    else if (lower.includes('6') || lower.includes('trade-off') || lower.includes('availability'))
      rawId = 'availability-tradeoff';

    const scenarioId: ScenarioId = scenarioIdSchema.parse(rawId);
    const command: VoiceCommand = {
      command: 'load_scenario',
      scenarioId,
    };
    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: `Load scenario "${scenarioId}" into active canvas`,
    });
  }

  // 5. Invariant setting
  if (lower.includes('invariant') || lower.includes('threshold') || lower.includes('requirement')) {
    let metric: VoiceCommand & { command: 'set_invariant' } extends { metric: infer M }
      ? M
      : never = 'e2e_p99_ms';
    let comparator: 'lt' | 'lte' | 'gt' | 'gte' = 'lt';
    let threshold = 500;

    if (lower.includes('error rate')) {
      metric = 'e2e_error_rate';
      threshold = 0.05;
      comparator = 'lt';
    } else if (lower.includes('completion rate')) {
      metric = 'completion_rate';
      threshold = 0.95;
      comparator = 'gte';
    } else if (lower.includes('retry amplification')) {
      metric = 'retry_amplification';
      threshold = 1.5;
      comparator = 'lt';
    }

    const numMatch = /(\d+(?:\.\d+)?)/.exec(lower);
    if (numMatch && numMatch[1]) {
      const parsed = parseFloat(numMatch[1]);
      if (!Number.isNaN(parsed)) {
        threshold = parsed;
      }
    }

    const command: VoiceCommand = {
      command: 'set_invariant',
      metric,
      comparator,
      threshold,
    };
    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: `Set invariant: ${metric} ${comparator} ${String(threshold)}`,
    });
  }

  // 6. Fault injection
  if (
    lower.includes('inject') ||
    lower.includes('fault') ||
    lower.includes('latency') ||
    lower.includes('stall') ||
    lower.includes('delay') ||
    lower.includes('break') ||
    lower.includes('reset')
  ) {
    const edgeMatch = resolveEdgeFromSpokenText(transcript, edges, nodes);
    if (edgeMatch.status === 'ambiguous') {
      return finish({
        status: 'ambiguous',
        candidates: edgeMatch.candidates.map((c) => c.id),
        message: edgeMatch.message ?? 'Multiple target edges match spoken command.',
      });
    }
    if (edgeMatch.status === 'none' || !edgeMatch.edge) {
      return finish({
        status: 'unsupported',
        message: 'Could not resolve target edge for fault injection in active topology.',
      });
    }

    let faultType: 'latency' | 'stall' | 'connection_reset' | 'dependency_down' = 'latency';
    let latencyMs = 300;
    if (lower.includes('stall')) faultType = 'stall';
    else if (lower.includes('reset')) faultType = 'connection_reset';
    else if (lower.includes('down')) faultType = 'dependency_down';

    const msMatch = /(\d+)\s*(?:ms|milliseconds?)/.exec(lower);
    if (msMatch && msMatch[1]) {
      const parsed = parseInt(msMatch[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 60_000) {
        latencyMs = parsed;
      }
    }

    const command: VoiceCommand = {
      command: 'inject_fault',
      source: edgeMatch.edge.source,
      target: edgeMatch.edge.target,
      faultType,
      parameters: {
        ...(faultType === 'latency' ? { latencyMs, jitterMs: 50 } : {}),
        ...(faultType === 'stall' ? { holdMs: 500 } : {}),
        ...(faultType === 'connection_reset' ? { resetAfterMs: 100 } : {}),
      },
    };

    return finish({
      status: 'parsed',
      command,
      plainTextConfirmation: `Inject ${faultType} fault on link ${edgeMatch.edge.source} -> ${edgeMatch.edge.target}${faultType === 'latency' ? ` (${String(latencyMs)}ms)` : ''}`,
    });
  }

  return finish({
    status: 'unsupported',
    message: `Unsupported command: "${transcript}". Valid commands include: inject fault, run experiment, start repair, set invariant, cancel, or load scenario.`,
  });
}
