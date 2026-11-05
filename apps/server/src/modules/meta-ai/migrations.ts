import type { ModuleMigrations } from '../../platform/migrations';

export const usageMigrations: ModuleMigrations = {
  module: 'model_usage',
  migrations: [
    {
      version: 1,
      name: 'create_model_usage',
      sql: `
        CREATE TABLE IF NOT EXISTS model_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          capability TEXT NOT NULL,
          provider TEXT NOT NULL,
          model_id TEXT NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          audio_ms INTEGER NOT NULL DEFAULT 0,
          images INTEGER NOT NULL DEFAULT 0,
          cost_usd REAL NOT NULL,
          latency_ms INTEGER NOT NULL DEFAULT 0
        );
      `,
    },
    {
      version: 2,
      name: 'add_pricing_flags',
      sql: `
        ALTER TABLE model_usage ADD COLUMN priced INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE model_usage ADD COLUMN estimated INTEGER NOT NULL DEFAULT 0;
      `,
    },
  ],
};
