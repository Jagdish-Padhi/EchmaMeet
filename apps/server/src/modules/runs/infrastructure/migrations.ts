export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface ModuleMigrations {
  readonly module: string;
  readonly migrations: readonly Migration[];
}

export const runsMigrations: ModuleMigrations = {
  module: 'runs',
  migrations: [
    {
      version: 1,
      name: 'create_runs_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          topology TEXT NOT NULL,
          faults TEXT NOT NULL,
          invariants TEXT NOT NULL,
          trial_config TEXT NOT NULL,
          baseline_aggregate TEXT,
          faulted_aggregate TEXT,
          verdicts TEXT NOT NULL,
          overall_status TEXT,
          provenance TEXT NOT NULL,
          created_at TEXT NOT NULL,
          finished_at TEXT,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS run_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          timestamp_ms REAL NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          UNIQUE(run_id, sequence)
        );

        CREATE TABLE IF NOT EXISTS run_trials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          trial_index INTEGER NOT NULL,
          phase TEXT NOT NULL,
          trial_result TEXT NOT NULL,
          UNIQUE(run_id, phase, trial_index)
        );

        CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_run_events_run_id_seq ON run_events(run_id, sequence ASC);
        CREATE INDEX IF NOT EXISTS idx_run_trials_run_id ON run_trials(run_id);
      `,
    },
  ],
};
