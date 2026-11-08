import { Pool, type PoolConfig } from 'pg';
import type { LedgerAnalytics, VoiceLedgerEntry, VoiceLedgerPort } from '../application/ports';

/**
 * Versioned, forward-only migrations. Each runs once inside a transaction guarded by a
 * Postgres advisory lock, so several server instances can boot against one Neon database.
 */
export const VOICE_LEDGER_MIGRATIONS: readonly {
  readonly version: number;
  readonly sql: string;
}[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE voice_commands (
        id            TEXT PRIMARY KEY,
        created_at    TIMESTAMPTZ NOT NULL,
        source        TEXT NOT NULL CHECK (source IN ('websocket','http')),
        language      TEXT NOT NULL,
        transcript    TEXT NOT NULL,
        status        TEXT NOT NULL CHECK (status IN ('parsed','ambiguous','unsupported','empty')),
        command_type  TEXT,
        stt_model     TEXT,
        stt_ms        INTEGER NOT NULL CHECK (stt_ms >= 0),
        parse_ms      INTEGER NOT NULL CHECK (parse_ms >= 0),
        tts_ms        INTEGER CHECK (tts_ms IS NULL OR tts_ms >= 0)
      );
      CREATE INDEX voice_commands_created_idx ON voice_commands (created_at DESC);
      CREATE INDEX voice_commands_language_idx ON voice_commands (language);
    `,
  },
];

const LOCK_KEY = 872_001;

export function poolConfigFor(connectionString: string): PoolConfig {
  // Neon (and most hosted Postgres) requires TLS; honour sslmode in the URL, default to TLS
  // for non-local hosts.
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  const noSsl = /sslmode=disable/.test(connectionString);
  return {
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
    ...(local || noSsl ? {} : { ssl: { rejectUnauthorized: true } }),
  };
}

interface Row {
  id: string;
  created_at: Date;
  source: 'websocket' | 'http';
  language: string;
  transcript: string;
  status: VoiceLedgerEntry['status'];
  command_type: string | null;
  stt_model: string | null;
  stt_ms: number;
  parse_ms: number;
  tts_ms: number | null;
}

export class PgVoiceLedger implements VoiceLedgerPort {
  readonly backend = 'postgres' as const;

  private constructor(private readonly pool: Pool) {}

  static async connect(connectionString: string): Promise<PgVoiceLedger> {
    const pool = new Pool(poolConfigFor(connectionString));
    pool.on('error', () => undefined); // idle-client errors must not crash the process
    const ledger = new PgVoiceLedger(pool);
    await ledger.migrate();
    return ledger;
  }

  async migrate(): Promise<number[]> {
    const client = await this.pool.connect();
    const applied: number[] = [];
    try {
      await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
      await client.query(
        `CREATE TABLE IF NOT EXISTS voice_ledger_migrations (
           version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      );
      const done = await client.query<{ version: number }>(
        'SELECT version FROM voice_ledger_migrations',
      );
      const seen = new Set(done.rows.map((r) => r.version));
      for (const m of VOICE_LEDGER_MIGRATIONS) {
        if (seen.has(m.version)) continue;
        await client.query('BEGIN');
        try {
          await client.query(m.sql);
          await client.query('INSERT INTO voice_ledger_migrations (version) VALUES ($1)', [
            m.version,
          ]);
          await client.query('COMMIT');
          applied.push(m.version);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
      client.release();
    }
    return applied;
  }

  async record(e: VoiceLedgerEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO voice_commands
         (id, created_at, source, language, transcript, status, command_type, stt_model, stt_ms, parse_ms, tts_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id,
        e.createdAt,
        e.source,
        e.language,
        e.transcript.slice(0, 2000),
        e.status,
        e.commandType,
        e.sttModel,
        e.sttMs,
        e.parseMs,
        e.ttsMs,
      ],
    );
  }

  async recent(limit: number): Promise<readonly VoiceLedgerEntry[]> {
    const { rows } = await this.pool.query<Row>(
      'SELECT * FROM voice_commands ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(1, limit), 200)],
    );
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      source: r.source,
      language: r.language,
      transcript: r.transcript,
      status: r.status,
      commandType: r.command_type,
      sttModel: r.stt_model,
      sttMs: r.stt_ms,
      parseMs: r.parse_ms,
      ttsMs: r.tts_ms,
    }));
  }

  async analytics(): Promise<LedgerAnalytics> {
    const [totals, langs, statuses, commands, latency] = await Promise.all([
      this.pool.query<{ total: string; parsed: string; nonempty: string }>(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE status = 'parsed') AS parsed,
                count(*) FILTER (WHERE status <> 'empty') AS nonempty
           FROM voice_commands`,
      ),
      this.pool.query<{ language: string; count: string }>(
        'SELECT language, count(*) AS count FROM voice_commands GROUP BY language ORDER BY count DESC',
      ),
      this.pool.query<{ status: string; count: string }>(
        'SELECT status, count(*) AS count FROM voice_commands GROUP BY status ORDER BY count DESC',
      ),
      this.pool.query<{ command: string; count: string }>(
        `SELECT command_type AS command, count(*) AS count FROM voice_commands
          WHERE command_type IS NOT NULL GROUP BY command_type ORDER BY count DESC`,
      ),
      this.pool.query<{ p50: number | null; p95: number | null }>(
        `SELECT percentile_cont(0.5)  WITHIN GROUP (ORDER BY stt_ms) AS p50,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY stt_ms) AS p95
           FROM voice_commands WHERE stt_ms > 0`,
      ),
    ]);
    const t = totals.rows[0];
    const nonEmpty = Number(t?.nonempty ?? 0);
    const lat = latency.rows[0];
    return {
      total: Number(t?.total ?? 0),
      byLanguage: langs.rows.map((r) => ({ language: r.language, count: Number(r.count) })),
      byStatus: statuses.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      byCommand: commands.rows.map((r) => ({ command: r.command, count: Number(r.count) })),
      sttLatencyMs:
        lat?.p50 === null || lat?.p95 === null || lat === undefined
          ? null
          : { p50: Math.round(lat.p50), p95: Math.round(lat.p95) },
      successRatePct:
        nonEmpty > 0 ? Math.round((Number(t?.parsed ?? 0) / nonEmpty) * 1000) / 10 : null,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
