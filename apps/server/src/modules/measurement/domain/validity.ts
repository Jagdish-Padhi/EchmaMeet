import type {
  EventLoopDelaySummary,
  PercentileSummary,
  TrialValidity,
} from '@chaosboard/contracts';

export interface ValidityLimits {
  maxP99GeneratorLagMs?: number;
  maxGeneratorLagMs?: number;
  maxP99EventLoopDelayMs?: number;
}

export function evaluateTrialValidity(params: {
  generatorLag: PercentileSummary;
  generatorEventLoopDelay: EventLoopDelaySummary;
  workerEventLoopDelays: Record<string, EventLoopDelaySummary>;
  processCrash?: string | null | undefined;
  limits?: ValidityLimits | undefined;
}): TrialValidity {
  const {
    generatorLag,
    generatorEventLoopDelay,
    workerEventLoopDelays,
    processCrash,
    limits = {},
  } = params;

  if (processCrash) {
    return {
      valid: false,
      reason: `Process crashed unexpectedly during trial: ${processCrash}`,
    };
  }

  const maxP99Lag = limits.maxP99GeneratorLagMs ?? 100;
  if (generatorLag.p99Ms > maxP99Lag) {
    return {
      valid: false,
      reason: `Generator p99 lag (${String(generatorLag.p99Ms)}ms) exceeded validity limit (${String(maxP99Lag)}ms)`,
    };
  }

  const maxLag = limits.maxGeneratorLagMs ?? 250;
  if (generatorLag.maxMs > maxLag) {
    return {
      valid: false,
      reason: `Generator max lag (${String(generatorLag.maxMs)}ms) exceeded validity limit (${String(maxLag)}ms)`,
    };
  }

  const maxP99Delay = limits.maxP99EventLoopDelayMs ?? 150;
  if (generatorEventLoopDelay.p99Ms > maxP99Delay) {
    return {
      valid: false,
      reason: `Generator event loop delay p99 (${String(generatorEventLoopDelay.p99Ms)}ms) exceeded validity limit (${String(maxP99Delay)}ms)`,
    };
  }

  for (const [nodeId, delay] of Object.entries(workerEventLoopDelays)) {
    if (delay.p99Ms > maxP99Delay) {
      return {
        valid: false,
        reason: `Worker node '${nodeId}' event loop delay p99 (${String(delay.p99Ms)}ms) exceeded validity limit (${String(maxP99Delay)}ms)`,
      };
    }
  }

  return {
    valid: true,
    reason: null,
  };
}
