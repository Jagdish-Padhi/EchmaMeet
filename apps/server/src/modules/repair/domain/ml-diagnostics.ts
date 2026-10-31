import type { RepairPatch, Topology, TrialAggregate } from '@chaosboard/contracts';
import { TRAINED_FOREST_DATA } from './trained-model-data';

export type FailureRootCause =
  | 'AVAILABILITY_TRADEOFF'
  | 'HEALTHY_STEADY_STATE'
  | 'MISSING_TIMEOUT_CASCADE'
  | 'NON_IDEMPOTENT_RETRY'
  | 'OVERSENSITIVE_BREAKER'
  | 'RETRY_STORM'
  | 'UNBOUNDED_QUEUE';

export interface MLDiagnosisFeatureInput {
  readonly p50_latency_ms: number;
  readonly p95_latency_ms: number;
  readonly p99_latency_ms: number;
  readonly completion_rate: number;
  readonly retry_amplification: number;
  readonly worker_saturation: number;
  readonly max_queue_depth: number;
  readonly duplicate_write_rate: number;
  readonly breaker_open_fraction: number;
}

export interface MLDiagnosisResult {
  readonly predictedRootCause: FailureRootCause;
  readonly confidence: number;
  readonly probabilities: Record<FailureRootCause, number>;
  readonly recommendedPolicy: string;
  readonly topContributingMetrics: readonly {
    readonly feature: string;
    readonly importance: number;
    readonly value: number;
  }[];
}

interface ForestTreeNode {
  readonly type: 'split' | 'leaf';
  readonly feature?: string;
  readonly threshold?: number;
  readonly left?: ForestTreeNode;
  readonly right?: ForestTreeNode;
  readonly class_idx?: number;
  readonly probabilities?: readonly number[];
}

const POLICY_RECOMMENDATIONS: Record<FailureRootCause, string> = {
  HEALTHY_STEADY_STATE: 'No mitigation needed. System operating within acceptable SLA envelopes.',
  RETRY_STORM:
    'Add exponential backoff with full jitter (e.g., base=100ms, max=2000ms) and cap retry attempts to 1-2.',
  MISSING_TIMEOUT_CASCADE:
    'Set strict bounded upstream timeout (e.g., 500ms) to unpin worker threads before cascade propagates.',
  UNBOUNDED_QUEUE:
    'Configure bounded queue capacity with drop-tail or drop-head backpressure policy.',
  NON_IDEMPOTENT_RETRY:
    'Enforce idempotency keys and deduplication cache on mutating endpoints.',
  OVERSENSITIVE_BREAKER:
    'Relax circuit breaker sensitivity: increase failure threshold percentage and expand observation window.',
  AVAILABILITY_TRADEOFF:
    'Enable fallback cache / graceful degradation for partitioned downstream dependency.',
};

const FEATURE_IMPORTANCES: Record<string, number> = {
  retry_amplification: 0.1513,
  duplicate_write_rate: 0.1481,
  p99_latency_ms: 0.1456,
  completion_rate: 0.1451,
  p95_latency_ms: 0.1392,
  max_queue_depth: 0.1165,
  breaker_open_fraction: 0.1151,
  worker_saturation: 0.0246,
  p50_latency_ms: 0.0145,
};

function traverseTree(node: ForestTreeNode, features: Record<string, number>): readonly number[] {
  if (node.type === 'leaf' && node.probabilities) {
    return node.probabilities;
  }
  const featureName = node.feature ?? '';
  const val = features[featureName] ?? 0;
  const threshold = node.threshold ?? 0;

  if (val <= threshold) {
    return node.left ? traverseTree(node.left, features) : [];
  } else {
    return node.right ? traverseTree(node.right, features) : [];
  }
}

/**
 * Extracts normalized ML telemetry features from a trial aggregate.
 */
export function extractFeaturesFromTrial(aggregate: TrialAggregate): MLDiagnosisFeatureInput {
  const p50 = aggregate.metrics.p50LatencyMs.median ?? 25;
  const p99 = aggregate.metrics.p99LatencyMs.median ?? 85;
  const p95 = Math.round((p50 + (p99 - p50) * 0.7) * 100) / 100;
  const completionRate = aggregate.metrics.completionRate.median ?? 1.0;

  // Max retry amplification across edges
  let maxRetryAmp = 1.0;
  for (const v of Object.values(aggregate.metrics.retryAmplification)) {
    if (v.median !== null && v.median > maxRetryAmp) {
      maxRetryAmp = v.median;
    }
  }

  // Max worker saturation across nodes
  let maxSaturation = 0.3;
  for (const v of Object.values(aggregate.metrics.workerSaturation)) {
    if (v.median !== null && v.median > maxSaturation) {
      maxSaturation = v.median;
    }
  }

  // Max queue depth across nodes
  let maxQueue = 0;
  for (const v of Object.values(aggregate.metrics.maxQueueDepth)) {
    if (v.median !== null && v.median > maxQueue) {
      maxQueue = v.median;
    }
  }

  // Duplicate write rate
  const dupRate = aggregate.metrics.duplicateWriteRate.median ?? 0.0;

  // Max breaker open fraction
  let maxBreakerOpen = 0.0;
  for (const v of Object.values(aggregate.metrics.breakerOpenFraction)) {
    if (v.median !== null && v.median > maxBreakerOpen) {
      maxBreakerOpen = v.median;
    }
  }

  return {
    p50_latency_ms: p50,
    p95_latency_ms: p95,
    p99_latency_ms: p99,
    completion_rate: completionRate,
    retry_amplification: maxRetryAmp,
    worker_saturation: maxSaturation,
    max_queue_depth: maxQueue,
    duplicate_write_rate: dupRate,
    breaker_open_fraction: maxBreakerOpen,
  };
}

/**
 * Evaluates the trained Random Forest model on raw or extracted telemetry metrics.
 */
export function diagnoseWithMLModel(features: MLDiagnosisFeatureInput): MLDiagnosisResult {
  const model = TRAINED_FOREST_DATA;
  const numClasses = model.classes.length;
  const numTrees = model.trees.length;
  const aggregatedVotes = new Array<number>(numClasses).fill(0);

  const featureMap: Record<string, number> = {
    p50_latency_ms: features.p50_latency_ms,
    p95_latency_ms: features.p95_latency_ms,
    p99_latency_ms: features.p99_latency_ms,
    completion_rate: features.completion_rate,
    retry_amplification: features.retry_amplification,
    worker_saturation: features.worker_saturation,
    max_queue_depth: features.max_queue_depth,
    duplicate_write_rate: features.duplicate_write_rate,
    breaker_open_fraction: features.breaker_open_fraction,
  };

  // Run through every decision tree in the Random Forest ensemble
  for (let i = 0; i < numTrees; i++) {
    const tree = model.trees[i] as ForestTreeNode;
    const treeProbs = traverseTree(tree, featureMap);
    for (let c = 0; c < numClasses; c++) {
      const currentVal = aggregatedVotes[c] ?? 0;
      aggregatedVotes[c] = currentVal + (treeProbs[c] ?? 0) / numTrees;
    }
  }

  // Find class with highest probability
  let bestIdx = 0;
  let highestProb = -1;
  const probabilitiesRecord: Record<FailureRootCause, number> = {
    AVAILABILITY_TRADEOFF: 0,
    HEALTHY_STEADY_STATE: 0,
    MISSING_TIMEOUT_CASCADE: 0,
    NON_IDEMPOTENT_RETRY: 0,
    OVERSENSITIVE_BREAKER: 0,
    RETRY_STORM: 0,
    UNBOUNDED_QUEUE: 0,
  };

  for (let c = 0; c < numClasses; c++) {
    const prob = Math.round((aggregatedVotes[c] ?? 0) * 10000) / 10000;
    const className = model.classes[c];
    if (className) {
      probabilitiesRecord[className] = prob;
    }
    if (prob > highestProb) {
      highestProb = prob;
      bestIdx = c;
    }
  }

  const bestClass = model.classes[bestIdx] ?? 'HEALTHY_STEADY_STATE';
  const recommendedPolicy = POLICY_RECOMMENDATIONS[bestClass];

  // Top contributing metrics
  const topMetrics = Object.entries(FEATURE_IMPORTANCES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([feat, importance]) => ({
      feature: feat,
      importance,
      value: featureMap[feat] ?? 0,
    }));

  return {
    predictedRootCause: bestClass,
    confidence: highestProb,
    probabilities: probabilitiesRecord,
    recommendedPolicy,
    topContributingMetrics: topMetrics,
  };
}

/**
 * Creates an automated repair patch based on the ML diagnosis.
 */
export function proposeMLRepairPatch(
  topology: Topology,
  diagnosis: MLDiagnosisResult,
): RepairPatch | null {
  const { predictedRootCause, confidence } = diagnosis;

  if (predictedRootCause === 'HEALTHY_STEADY_STATE' || confidence < 0.3) {
    return null;
  }

  const primaryEdge = topology.edges[0];
  const primaryNode = topology.nodes[0];

  if (predictedRootCause === 'RETRY_STORM' && primaryEdge) {
    return {
      schemaVersion: 1,
      hypothesis: `ML Random Forest diagnosed RETRY_STORM (${(confidence * 100).toFixed(1)}% confidence). Dampening retry storm with backoff and jitter.`,
      operations: [
        {
          op: 'set_retry',
          edgeId: primaryEdge.id,
          maxAttempts: 1,
          backoffBaseMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 1000,
          jitter: 'full',
          rationale: `ML Random Forest diagnosed RETRY_STORM (${(confidence * 100).toFixed(1)}% confidence). Applied exponential backoff with full jitter.`,
        },
      ],
    };
  }

  if (predictedRootCause === 'MISSING_TIMEOUT_CASCADE' && primaryEdge) {
    return {
      schemaVersion: 1,
      hypothesis: `ML Random Forest diagnosed MISSING_TIMEOUT_CASCADE (${(confidence * 100).toFixed(1)}% confidence). Enforcing bounded timeout.`,
      operations: [
        {
          op: 'set_timeout',
          edgeId: primaryEdge.id,
          timeoutMs: 500,
          rationale: `ML Random Forest diagnosed MISSING_TIMEOUT_CASCADE (${(confidence * 100).toFixed(1)}% confidence). Applied strict 500ms timeout boundary.`,
        },
      ],
    };
  }

  if (predictedRootCause === 'UNBOUNDED_QUEUE' && primaryNode) {
    return {
      schemaVersion: 1,
      hypothesis: `ML Random Forest diagnosed UNBOUNDED_QUEUE (${(confidence * 100).toFixed(1)}% confidence). Bounding queue to mitigate latency drift.`,
      operations: [
        {
          op: 'set_queue',
          nodeId: primaryNode.id,
          mode: 'bounded',
          maxDepth: 100,
          rationale: `ML Random Forest diagnosed UNBOUNDED_QUEUE (${(confidence * 100).toFixed(1)}% confidence). Bounded queue to 100 requests.`,
        },
      ],
    };
  }

  if (predictedRootCause === 'OVERSENSITIVE_BREAKER' && primaryEdge) {
    return {
      schemaVersion: 1,
      hypothesis: `ML Random Forest diagnosed OVERSENSITIVE_BREAKER (${(confidence * 100).toFixed(1)}% confidence). Relaxing breaker threshold.`,
      operations: [
        {
          op: 'set_circuit_breaker',
          edgeId: primaryEdge.id,
          enabled: true,
          failureThresholdPct: 60,
          windowRequests: 20,
          cooldownMs: 2000,
          halfOpenProbes: 3,
          rationale: `ML Random Forest diagnosed OVERSENSITIVE_BREAKER (${(confidence * 100).toFixed(1)}% confidence). Relaxed circuit breaker sensitivity.`,
        },
      ],
    };
  }

  return null;
}
