import type { RunId } from '@chaosboard/contracts';
import type { RunsService } from '../../runs';
import {
  diagnoseWithMLModel,
  extractFeaturesFromTrial,
  type MLDiagnosisFeatureInput,
  type MLDiagnosisResult,
} from '../domain/ml-diagnostics';

export interface MLDiagnosisResponse {
  readonly diagnosis: MLDiagnosisResult;
  readonly features: MLDiagnosisFeatureInput;
}

export class MLDiagnosisService {
  constructor(private readonly runs: RunsService) {}

  diagnoseTelemetry(features: MLDiagnosisFeatureInput): MLDiagnosisResponse {
    const diagnosis = diagnoseWithMLModel(features);
    return { diagnosis, features };
  }

  diagnoseRun(runId: RunId): MLDiagnosisResponse | null {
    const run = this.runs.getRun(runId);
    if (!run) {
      return null;
    }

    let features: MLDiagnosisFeatureInput;
    const aggregate = run.faultedAggregate ?? run.baselineAggregate;
    if (aggregate) {
      features = extractFeaturesFromTrial(aggregate);
    } else {
      features = {
        p50_latency_ms: 25,
        p95_latency_ms: 55,
        p99_latency_ms: 85,
        completion_rate: 1.0,
        retry_amplification: 1.0,
        worker_saturation: 0.3,
        max_queue_depth: 0,
        duplicate_write_rate: 0.0,
        breaker_open_fraction: 0.0,
      };
    }

    const diagnosis = diagnoseWithMLModel(features);
    return { diagnosis, features };
  }
}
