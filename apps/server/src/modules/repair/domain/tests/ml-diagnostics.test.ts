import { describe, it, expect } from 'vitest';
import { diagnoseWithMLModel, proposeMLRepairPatch, type MLDiagnosisFeatureInput } from '../ml-diagnostics';
import { edgeIdSchema, nodeIdSchema, topologyIdSchema, type Topology } from '@chaosboard/contracts';

describe('ML Diagnostics & Random Forest Root-Cause Diagnosis', () => {
  it('correctly classifies a healthy steady state with high confidence', () => {
    const healthyInput: MLDiagnosisFeatureInput = {
      p50_latency_ms: 25,
      p95_latency_ms: 55,
      p99_latency_ms: 85,
      completion_rate: 1.0,
      retry_amplification: 1.01,
      worker_saturation: 0.32,
      max_queue_depth: 3,
      duplicate_write_rate: 0.0,
      breaker_open_fraction: 0.0,
    };

    const diagnosis = diagnoseWithMLModel(healthyInput);
    expect(diagnosis.predictedRootCause).toBe('HEALTHY_STEADY_STATE');
    expect(diagnosis.confidence).toBeGreaterThan(0.9);
    expect(diagnosis.probabilities.HEALTHY_STEADY_STATE).toBeGreaterThan(0.9);
    expect(diagnosis.recommendedPolicy).toContain('acceptable SLA');
  });

  it('correctly diagnoses a retry storm from telemetry features', () => {
    const retryStormInput: MLDiagnosisFeatureInput = {
      p50_latency_ms: 190,
      p95_latency_ms: 540,
      p99_latency_ms: 1150,
      completion_rate: 0.65,
      retry_amplification: 3.9,
      worker_saturation: 0.96,
      max_queue_depth: 145,
      duplicate_write_rate: 0.01,
      breaker_open_fraction: 0.04,
    };

    const diagnosis = diagnoseWithMLModel(retryStormInput);
    expect(diagnosis.predictedRootCause).toBe('RETRY_STORM');
    expect(diagnosis.confidence).toBeGreaterThan(0.5);
    expect(diagnosis.recommendedPolicy).toContain('exponential backoff');
    expect(diagnosis.topContributingMetrics.length).toBe(4);
  });

  it('correctly diagnoses a missing timeout cascade', () => {
    const missingTimeoutInput: MLDiagnosisFeatureInput = {
      p50_latency_ms: 360,
      p95_latency_ms: 1650,
      p99_latency_ms: 2900,
      completion_rate: 0.52,
      retry_amplification: 1.04,
      worker_saturation: 0.99,
      max_queue_depth: 95,
      duplicate_write_rate: 0.0,
      breaker_open_fraction: 0.0,
    };

    const diagnosis = diagnoseWithMLModel(missingTimeoutInput);
    expect(diagnosis.predictedRootCause).toBe('MISSING_TIMEOUT_CASCADE');
    expect(diagnosis.confidence).toBeGreaterThan(0.9);
    expect(diagnosis.recommendedPolicy).toContain('timeout');
  });

  it('correctly diagnoses non-idempotent retry with duplicate writes', () => {
    const nonIdempotentInput: MLDiagnosisFeatureInput = {
      p50_latency_ms: 65,
      p95_latency_ms: 145,
      p99_latency_ms: 250,
      completion_rate: 0.91,
      retry_amplification: 1.48,
      worker_saturation: 0.54,
      max_queue_depth: 10,
      duplicate_write_rate: 0.085,
      breaker_open_fraction: 0.0,
    };

    const diagnosis = diagnoseWithMLModel(nonIdempotentInput);
    expect(diagnosis.predictedRootCause).toBe('NON_IDEMPOTENT_RETRY');
    expect(diagnosis.confidence).toBeGreaterThan(0.85);
    expect(diagnosis.recommendedPolicy).toContain('idempotency');
  });

  it('proposes a concrete repair patch for an identified retry storm', () => {
    const clientNodeId = nodeIdSchema.parse('node-client');
    const upstreamNodeId = nodeIdSchema.parse('node-upstream');
    const edgeId = edgeIdSchema.parse('edge-1');
    const topoId = topologyIdSchema.parse('topo-1');

    const sampleTopology: Topology = {
      schemaVersion: 1,
      id: topoId,
      name: 'Sample Topology',
      source: 'scenario',
      entry: { nodeId: clientNodeId },
      nodes: [
        {
          id: clientNodeId,
          label: 'Client Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: edgeId,
          source: clientNodeId,
          target: upstreamNodeId,
          mode: 'sync_call',
          policy: {
            timeoutMs: 1000,
            retry: { maxAttempts: 3, backoffBaseMs: 0, backoffMultiplier: 1, maxBackoffMs: 0, jitter: 'none' },
            breaker: { enabled: false, failureThresholdPct: 50, windowRequests: 10, cooldownMs: 3000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
      ],
    };

    const diagnosis = diagnoseWithMLModel({
      p50_latency_ms: 190,
      p95_latency_ms: 540,
      p99_latency_ms: 1150,
      completion_rate: 0.65,
      retry_amplification: 3.9,
      worker_saturation: 0.96,
      max_queue_depth: 145,
      duplicate_write_rate: 0.01,
      breaker_open_fraction: 0.04,
    });

    const patch = proposeMLRepairPatch(sampleTopology, diagnosis);
    expect(patch).not.toBeNull();
    expect(patch?.schemaVersion).toBe(1);
    expect(patch?.operations[0]?.op).toBe('set_retry');
    expect(patch?.operations[0]?.rationale).toContain('ML Random Forest diagnosed RETRY_STORM');
  });
});
