import { z } from 'zod';
import type { SqlDatabase } from '../../../platform/db';
import type { RunsRepositoryPort, UpdateRunDetails } from '../application/ports';
import {
  runEventSchema,
  runRecordSchema,
  runSummarySchema,
  trialResultSchema,
  type RunEvent,
  type RunId,
  type RunRecord,
  type RunStatus,
  type RunSummary,
  type TrialResult,
} from '@chaosboard/contracts';

const runRowSchema = z.strictObject({
  id: z.string(),
  status: z.string(),
  topology: z.string(),
  faults: z.string(),
  invariants: z.string(),
  trial_config: z.string(),
  baseline_aggregate: z.string().nullable(),
  faulted_aggregate: z.string().nullable(),
  verdicts: z.string(),
  overall_status: z.string().nullable(),
  provenance: z.string(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
  error_message: z.string().nullable(),
});

const eventRowSchema = z.strictObject({
  run_id: z.string(),
  sequence: z.number(),
  timestamp_ms: z.number(),
  type: z.string(),
  payload: z.string(),
});

const trialRowSchema = z.strictObject({
  trial_index: z.number(),
  phase: z.string(),
  trial_result: z.string(),
});

export class SqliteRunsRepository implements RunsRepositoryPort {
  constructor(private readonly db: SqlDatabase) {}

  createRun(run: RunRecord): void {
    const validated = runRecordSchema.parse(run);
    this.db.run(
      `
      INSERT INTO runs (
        id, status, topology, faults, invariants, trial_config,
        baseline_aggregate, faulted_aggregate, verdicts, overall_status,
        provenance, created_at, finished_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        validated.id,
        validated.status,
        JSON.stringify(validated.topology),
        JSON.stringify(validated.faults),
        JSON.stringify(validated.invariants),
        JSON.stringify(validated.trialConfig),
        validated.baselineAggregate ? JSON.stringify(validated.baselineAggregate) : null,
        validated.faultedAggregate ? JSON.stringify(validated.faultedAggregate) : null,
        JSON.stringify(validated.verdicts),
        validated.overallStatus,
        JSON.stringify(validated.provenance),
        validated.createdAt,
        validated.finishedAt,
        validated.errorMessage,
      ],
    );
  }

  updateRunStatus(id: RunId, status: RunStatus, details: UpdateRunDetails = {}): void {
    const sets: string[] = ['status = ?'];
    const params: (string | null)[] = [status];

    if (details.finishedAt !== undefined) {
      sets.push('finished_at = ?');
      params.push(details.finishedAt);
    }
    if (details.errorMessage !== undefined) {
      sets.push('error_message = ?');
      params.push(details.errorMessage);
    }
    if (details.baselineAggregate !== undefined) {
      sets.push('baseline_aggregate = ?');
      params.push(details.baselineAggregate ? JSON.stringify(details.baselineAggregate) : null);
    }
    if (details.faultedAggregate !== undefined) {
      sets.push('faulted_aggregate = ?');
      params.push(details.faultedAggregate ? JSON.stringify(details.faultedAggregate) : null);
    }
    if (details.verdicts !== undefined) {
      sets.push('verdicts = ?');
      params.push(JSON.stringify(details.verdicts));
    }
    if (details.overallStatus !== undefined) {
      sets.push('overall_status = ?');
      params.push(details.overallStatus);
    }

    params.push(id);
    this.db.run(`UPDATE runs SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  appendEvent(event: RunEvent): void {
    const validated = runEventSchema.parse(event);
    this.db.run(
      `
      INSERT INTO run_events (run_id, sequence, timestamp_ms, type, payload)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        validated.runId,
        validated.sequence,
        validated.timestampMs,
        validated.type,
        JSON.stringify(validated.payload),
      ],
    );
  }

  appendTrial(runId: RunId, phase: 'baseline' | 'faulted', trialResult: TrialResult): void {
    const validated = trialResultSchema.parse(trialResult);
    this.db.run(
      `
      INSERT INTO run_trials (run_id, trial_index, phase, trial_result)
      VALUES (?, ?, ?, ?)
      `,
      [runId, validated.trialIndex, phase, JSON.stringify(validated)],
    );
  }

  getRun(id: RunId): RunRecord | null {
    const raw = this.db.get('SELECT * FROM runs WHERE id = ?', [id]);
    if (!raw) return null;

    const row = runRowSchema.parse(raw);
    const parsed = {
      id: row.id,
      status: row.status,
      topology: JSON.parse(row.topology) as unknown,
      faults: JSON.parse(row.faults) as unknown,
      invariants: JSON.parse(row.invariants) as unknown,
      trialConfig: JSON.parse(row.trial_config) as unknown,
      baselineAggregate: row.baseline_aggregate
        ? (JSON.parse(row.baseline_aggregate) as unknown)
        : null,
      faultedAggregate: row.faulted_aggregate
        ? (JSON.parse(row.faulted_aggregate) as unknown)
        : null,
      verdicts: JSON.parse(row.verdicts) as unknown,
      overallStatus: row.overall_status,
      provenance: JSON.parse(row.provenance) as unknown,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      errorMessage: row.error_message,
    };

    return runRecordSchema.parse(parsed);
  }

  listRuns(limit = 50): RunSummary[] {
    const rows = this.db.all(
      `
      SELECT id, status, overall_status, topology, faults, invariants, created_at, finished_at
      FROM runs
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [limit],
    );

    const summaryRowSchema = z.strictObject({
      id: z.string(),
      status: z.string(),
      overall_status: z.string().nullable(),
      topology: z.string(),
      faults: z.string(),
      invariants: z.string(),
      created_at: z.string(),
      finished_at: z.string().nullable(),
    });

    return rows.map((raw) => {
      const row = summaryRowSchema.parse(raw);
      const topo = JSON.parse(row.topology) as { id?: string; name?: string };
      const faults = JSON.parse(row.faults) as unknown[];
      const invariants = JSON.parse(row.invariants) as unknown[];

      return runSummarySchema.parse({
        id: row.id,
        status: row.status,
        overallStatus: row.overall_status,
        topologyId: topo.id ?? 'unknown',
        topologyName: topo.name ?? 'unknown',
        faultCount: faults.length,
        invariantCount: invariants.length,
        createdAt: row.created_at,
        finishedAt: row.finished_at,
      });
    });
  }

  getEvents(runId: RunId): RunEvent[] {
    const rows = this.db.all(
      'SELECT run_id, sequence, timestamp_ms, type, payload FROM run_events WHERE run_id = ? ORDER BY sequence ASC',
      [runId],
    );

    return rows.map((raw) => {
      const row = eventRowSchema.parse(raw);
      return runEventSchema.parse({
        runId: row.run_id,
        sequence: row.sequence,
        timestampMs: row.timestamp_ms,
        type: row.type,
        payload: JSON.parse(row.payload) as unknown,
      });
    });
  }

  getTrials(runId: RunId): { baseline: TrialResult[]; faulted: TrialResult[] } {
    const rows = this.db.all(
      'SELECT trial_index, phase, trial_result FROM run_trials WHERE run_id = ? ORDER BY trial_index ASC',
      [runId],
    );

    const baseline: TrialResult[] = [];
    const faulted: TrialResult[] = [];

    for (const raw of rows) {
      const row = trialRowSchema.parse(raw);
      const trial = trialResultSchema.parse(JSON.parse(row.trial_result));
      if (row.phase === 'baseline') {
        baseline.push(trial);
      } else {
        faulted.push(trial);
      }
    }

    return { baseline, faulted };
  }
}
