import type { FastifyInstance, FastifyReply } from 'fastify';
import { runIdSchema, startRepairRequestSchema, type RunEvent } from '@chaosboard/contracts';
import { openEventStream, parseWith } from '../../../platform/http-kit';
import type { RepairOrchestratorPort } from '../application/ports';
import type { RunsService } from '../../runs';
import { MLDiagnosisService, type RunDiagnosisOutcome } from '../application/ml-diagnosis-service';

export function registerRepairRoutes(
  app: FastifyInstance,
  orchestrator: RepairOrchestratorPort,
  runs: RunsService,
): void {
  const mlDiagnosisService = new MLDiagnosisService(runs);

  const sendRunDiagnosis = (reply: FastifyReply, runId: string, outcome: RunDiagnosisOutcome) => {
    if (outcome.kind === 'ok') return reply.send(outcome.response);
    if (outcome.kind === 'run_not_found') {
      return reply.status(404).send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Run ${runId} was not found.`,
        code: 'run_not_found',
      });
    }
    return reply.status(409).send({
      type: 'about:blank',
      title: 'No Telemetry',
      status: 409,
      detail: `Run ${runId} has no measured telemetry to diagnose yet.`,
      code: 'run_has_no_telemetry',
    });
  };

  // POST /api/ml/diagnose
  app.post('/api/ml/diagnose', (req, reply) => {
    const body = req.body as {
      runId?: string;
      metrics?: {
        p50_latency_ms?: number;
        p95_latency_ms?: number;
        p99_latency_ms?: number;
        completion_rate?: number;
        retry_amplification?: number;
        worker_saturation?: number;
        max_queue_depth?: number;
        duplicate_write_rate?: number;
        breaker_open_fraction?: number;
      };
    };

    if (body.runId) {
      const parsedId = runIdSchema.parse(body.runId);
      return sendRunDiagnosis(reply, parsedId, mlDiagnosisService.diagnoseRun(parsedId));
    }

    const metrics = body.metrics ?? {};
    const result = mlDiagnosisService.diagnoseTelemetry({
      p50_latency_ms: metrics.p50_latency_ms ?? 25,
      p95_latency_ms: metrics.p95_latency_ms ?? 55,
      p99_latency_ms: metrics.p99_latency_ms ?? 85,
      completion_rate: metrics.completion_rate ?? 1.0,
      retry_amplification: metrics.retry_amplification ?? 1.0,
      worker_saturation: metrics.worker_saturation ?? 0.3,
      max_queue_depth: metrics.max_queue_depth ?? 0,
      duplicate_write_rate: metrics.duplicate_write_rate ?? 0.0,
      breaker_open_fraction: metrics.breaker_open_fraction ?? 0.0,
    });

    return reply.send(result);
  });

  // GET /api/runs/:id/ml-diagnosis
  app.get('/api/runs/:id/ml-diagnosis', (req, reply) => {
    const { id } = req.params as { id: string };
    const parsedId = runIdSchema.parse(id);
    return sendRunDiagnosis(reply, parsedId, mlDiagnosisService.diagnoseRun(parsedId));
  });
  // POST /api/repairs
  app.post('/api/repairs', async (req, reply) => {
    const parsed = parseWith(startRepairRequestSchema, req.body, 'start repair request');
    const repairId = await orchestrator.start(parsed);
    return reply.status(201).send({
      repairId,
      status: 'running',
    });
  });

  // GET /api/repairs/:id
  app.get('/api/repairs/:id', (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);
    const session = orchestrator.getRepair(repairId);
    if (!session) {
      return reply.status(404).send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Repair session ${repairId} was not found.`,
        code: 'repair_not_found',
      });
    }
    return reply.send(session);
  });

  // POST /api/repairs/:id/cancel
  app.post('/api/repairs/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);
    await orchestrator.cancel(repairId);
    return reply.send({
      repairId,
      status: 'cancelling',
    });
  });

  // GET /api/repairs/:id/events
  app.get('/api/repairs/:id/events', (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);

    const stream = openEventStream(reply);

    // Stream historical events first
    const historical = runs.getEvents(repairId);
    let lastSeq = -1;
    for (const ev of historical) {
      stream.send({
        id: String(ev.sequence),
        event: ev.type,
        data: ev,
      });
      lastSeq = Math.max(lastSeq, ev.sequence);

      if (
        ev.type === 'repair_finished' ||
        ev.type === 'repair_failed' ||
        ev.type === 'repair_cancelled'
      ) {
        stream.close();
        return;
      }
    }

    const unsubscribe = orchestrator.subscribe(repairId, (event: RunEvent) => {
      if (event.sequence > lastSeq) {
        lastSeq = event.sequence;
        stream.send({
          id: String(event.sequence),
          event: event.type,
          data: event,
        });

        if (
          event.type === 'repair_finished' ||
          event.type === 'repair_failed' ||
          event.type === 'repair_cancelled'
        ) {
          unsubscribe();
          stream.close();
        }
      }
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  });
}
