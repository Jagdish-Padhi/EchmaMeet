import type { ProposeRepairParams, ProposeRepairResult, RepairProposerPort } from '../ports';
import {
  diagnoseWithMLModel,
  extractFeaturesFromTrial,
  proposeMLRepairPatch,
  type MLDiagnosisFeatureInput,
} from '../../domain/ml-diagnostics';

export class MLRandomForestRepairProposer implements RepairProposerPort {
  propose(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    const { topology, record } = params;
    const startNs = process.hrtime.bigint();

    // 1. Extract telemetry features from the real trial metrics
    let features: MLDiagnosisFeatureInput;
    const aggregate = record.faultedAggregate ?? record.baselineAggregate;
    if (aggregate) {
      features = extractFeaturesFromTrial(aggregate);
    } else {
      // Derive heuristic defaults if no aggregate is present
      features = {
        p50_latency_ms: 30,
        p95_latency_ms: 70,
        p99_latency_ms: 120,
        completion_rate: 0.85,
        retry_amplification: 1.1,
        worker_saturation: 0.5,
        max_queue_depth: 10,
        duplicate_write_rate: 0.0,
        breaker_open_fraction: 0.0,
      };
    }

    // 2. Perform real-time Random Forest inference
    const diagnosis = diagnoseWithMLModel(features);

    // 3. Synthesize repair patch based on ML root cause diagnosis
    const patch = proposeMLRepairPatch(topology, diagnosis);
    const elapsedMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1e6);

    return Promise.resolve({
      patch,
      rawOutput: JSON.stringify({
        diagnosis,
        patch,
      }),
      metadata: {
        provider: 'ml_random_forest',
        modelId: 'random-forest-ensemble-100-trees-v1',
        promptVersion: 'supervised-classification-v1',
        latencyMs: elapsedMs,
      },
    });
  }
}
