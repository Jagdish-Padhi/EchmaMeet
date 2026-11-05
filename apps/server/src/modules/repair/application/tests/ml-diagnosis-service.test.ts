import { describe, it, expect, vi } from 'vitest';
import { MLDiagnosisService } from '../ml-diagnosis-service';
import type { RunsService } from '../../../runs';
import { runIdSchema, type RunRecord } from '@chaosboard/contracts';

describe('MLDiagnosisService', () => {
  const mockRunsService = {
    getRun: vi.fn(),
  } as unknown as RunsService;

  const service = new MLDiagnosisService(mockRunsService);

  it('diagnoses raw telemetry metrics directly', () => {
    const res = service.diagnoseTelemetry({
      p50_latency_ms: 180,
      p95_latency_ms: 520,
      p99_latency_ms: 1100,
      completion_rate: 0.65,
      retry_amplification: 3.8,
      worker_saturation: 0.95,
      max_queue_depth: 150,
      duplicate_write_rate: 0.01,
      breaker_open_fraction: 0.05,
    });

    expect(res.diagnosis.predictedRootCause).toBe('RETRY_STORM');
    expect(res.diagnosis.recommendedPolicy).toContain('exponential backoff');
    expect(res.features.retry_amplification).toBe(3.8);
  });

  it('diagnoses a run record by extracting its trial aggregate telemetry', () => {
    const runId = runIdSchema.parse('run-12345678');
    const mockRecord = {
      id: runId,
      status: 'completed',
      faultedAggregate: {
        trialsCount: 5,
        validTrialsCount: 5,
        invalidTrialsCount: 0,
        invalidReasons: [],
        metrics: {
          p50LatencyMs: { median: 350, p25: 300, p75: 400, iqr: 100 },
          p99LatencyMs: { median: 2800, p25: 2500, p75: 3100, iqr: 600 },
          completionRate: { median: 0.55, p25: 0.5, p75: 0.6, iqr: 0.1 },
          retryAmplification: { 'edge-1': { median: 1.05, p25: 1.0, p75: 1.1, iqr: 0.1 } },
          workerSaturation: { 'node-1': { median: 0.99, p25: 0.95, p75: 1.0, iqr: 0.05 } },
          maxQueueDepth: { 'node-1': { median: 90, p25: 80, p75: 100, iqr: 20 } },
          duplicateWriteRate: { median: 0.0, p25: 0, p75: 0, iqr: 0 },
          breakerOpenFraction: { 'edge-1': { median: 0.0, p25: 0, p75: 0, iqr: 0 } },
        },
      },
    };

    vi.spyOn(mockRunsService, 'getRun').mockReturnValue(mockRecord as unknown as RunRecord);

    const res = service.diagnoseRun(runId);
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.response.diagnosis.predictedRootCause).toBe('MISSING_TIMEOUT_CASCADE');
    expect(res.response.diagnosis.recommendedPolicy).toContain('timeout');
    expect(res.response.features.p99_latency_ms).toBe(2800);
  });

  it('reports run_not_found if the run does not exist', () => {
    const runId = runIdSchema.parse('run-missing-1');
    vi.spyOn(mockRunsService, 'getRun').mockReturnValue(null);
    expect(service.diagnoseRun(runId).kind).toBe('run_not_found');
  });

  it('does not invent telemetry for a run that has none', () => {
    const runId = runIdSchema.parse('run-notelem-1');
    vi.spyOn(mockRunsService, 'getRun').mockReturnValue({
      id: runId,
      status: 'running',
      faultedAggregate: null,
      baselineAggregate: null,
    } as unknown as RunRecord);
    // Previously this diagnosed a fabricated "healthy" feature vector.
    expect(service.diagnoseRun(runId).kind).toBe('no_telemetry');
  });
});
