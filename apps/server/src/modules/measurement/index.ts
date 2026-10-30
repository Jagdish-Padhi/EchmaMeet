import { MeasurementService, type BuildTrialResultParams } from './application/measurement-service';

export { MeasurementService };
export type { BuildTrialResultParams };
export {
  computeLatencyPercentiles,
  computeCompletionRate,
  computeRetryAmplification,
  computeWorkerSaturation,
  computeMaxQueueDepth,
  computeDuplicateWriteRate,
} from './domain/metrics';
export { evaluateTrialValidity, type ValidityLimits } from './domain/validity';
export { computeMedianAndIQR, aggregateTrialResults } from './domain/aggregate';
export { evaluateInvariantVerdict, computeOverallStatus } from './domain/verdict';

export function createMeasurementService(): MeasurementService {
  return new MeasurementService();
}
