/**
 * The policy catalog: the single definition of every numeric bound in the system.
 * Schemas, validators, the repair patch validator, and the UI forms all read from here, so a
 * bound can never drift between the place that checks it and the place that displays it.
 * This file is data only. Rules that use the data live in the modules.
 */

export interface Bound {
  readonly min: number;
  readonly max: number;
}

function bound(min: number, max: number): Bound {
  return { min, max };
}

export const catalog = {
  /** Maximum sizes, chosen so that the host, not the design, is never the bottleneck. */
  topology: {
    maxNodes: 12,
    maxEdges: 24,
    nameMaxLength: 80,
    labelMaxLength: 60,
  },
  node: {
    maxWorkers: bound(1, 500),
    queueDepth: bound(1, 10_000),
    processingMs: bound(0, 10_000),
    lognormalSigma: bound(0.01, 2),
    ingressRateLimitRps: bound(1, 5_000),
    cacheTtlMs: bound(100, 600_000),
    consumeRateRps: bound(1, 5_000),
  },
  edge: {
    timeoutMs: bound(10, 30_000),
    maxAttempts: bound(1, 6),
    backoffBaseMs: bound(0, 2_000),
    backoffMultiplier: bound(1, 4),
    maxBackoffMs: bound(0, 30_000),
    breakerFailureThresholdPct: bound(5, 100),
    breakerWindowRequests: bound(5, 200),
    breakerCooldownMs: bound(100, 30_000),
    breakerHalfOpenProbes: bound(1, 10),
    poolMaxConnections: bound(1, 500),
  },
  fault: {
    latencyMs: bound(1, 30_000),
    jitterMs: bound(0, 30_000),
    stallHoldMs: bound(1, 600_000),
    resetAfterMs: bound(0, 60_000),
    slowCloseDelayMs: bound(1, 30_000),
    bandwidthKbPerSec: bound(1, 1_000_000),
    dataLimitBytes: bound(1, 1_000_000_000),
    startOffsetMs: bound(0, 600_000),
  },
  trial: {
    arrivalRateRps: bound(1, 5_000),
    warmupMs: bound(0, 60_000),
    measurementMs: bound(1_000, 120_000),
    cooldownMs: bound(0, 30_000),
    clientTimeoutMs: bound(100, 60_000),
    trials: bound(1, 20),
  },
} as const;
