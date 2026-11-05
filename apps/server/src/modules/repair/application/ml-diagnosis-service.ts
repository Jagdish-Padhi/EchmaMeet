import type { RunId, RunRecord } from '@chaosboard/contracts';
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

  diagnoseRun(runId: RunId): RunDiagnosisOutcome {
    const run = this.runs.getRun(runId);
    if (!run) {
      return { kind: 'run_not_found' };
    }
    return diagnoseRunRecord(run);
  }
}

export type RunDiagnosisOutcome =
  | { readonly kind: 'ok'; readonly response: MLDiagnosisResponse }
  | { readonly kind: 'run_not_found' }
  /** The run has no measured aggregate; nothing is diagnosed rather than inventing telemetry. */
  | { readonly kind: 'no_telemetry' };

/** Diagnoses a stored run from its measured aggregate, or says that none exists. */
export function diagnoseRunRecord(run: RunRecord): RunDiagnosisOutcome {
  const aggregate = run.faultedAggregate ?? run.baselineAggregate;
  if (!aggregate) {
    return { kind: 'no_telemetry' };
  }
  const features = extractFeaturesFromTrial(aggregate);
  return { kind: 'ok', response: { diagnosis: diagnoseWithMLModel(features), features } };
}
