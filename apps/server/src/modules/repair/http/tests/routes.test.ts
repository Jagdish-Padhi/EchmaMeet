import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRepairRoutes } from '../routes';
import type { RepairOrchestratorPort } from '../../application/ports';
import type { RunsService } from '../../../runs';
import { runIdSchema, type RunRecord } from '@chaosboard/contracts';

describe('Repair & ML Diagnosis HTTP Routes', () => {
  const mockOrchestrator = {} as RepairOrchestratorPort;
  const mockRunsService = {
    getRun: vi.fn(),
    getEvents: vi.fn(),
  } as unknown as RunsService;

  const app = Fastify();
  registerRepairRoutes(app, mockOrchestrator, mockRunsService);

  it('POST /api/ml/diagnose evaluates telemetry metrics and returns diagnosis', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ml/diagnose',
      payload: {
        metrics: {
          p50_latency_ms: 180,
          p95_latency_ms: 540,
          p99_latency_ms: 1150,
          completion_rate: 0.65,
          retry_amplification: 3.8,
          worker_saturation: 0.95,
          max_queue_depth: 160,
          duplicate_write_rate: 0.01,
          breaker_open_fraction: 0.05,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.diagnosis.predictedRootCause).toBe('RETRY_STORM');
    expect(body.diagnosis.recommendedPolicy).toContain('exponential backoff');
    expect(body.features.retry_amplification).toBe(3.8);
  });

  it('GET /api/runs/:id/ml-diagnosis extracts telemetry and diagnoses run', async () => {
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

    const res = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/ml-diagnosis`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.diagnosis.predictedRootCause).toBe('MISSING_TIMEOUT_CASCADE');
    expect(body.features.p99_latency_ms).toBe(2800);
  });

  it('GET /api/runs/:id/ml-diagnosis returns 404 for unknown run', async () => {
    const runId = runIdSchema.parse('run-99999999');
    vi.spyOn(mockRunsService, 'getRun').mockReturnValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/ml-diagnosis`,
    });

    expect(res.statusCode).toBe(404);
  });
});
