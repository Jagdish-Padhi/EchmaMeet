import type { SqlDatabase } from '../../platform/db';
import { RunsService } from './application/runs-service';
import { SqliteRunsRepository } from './infrastructure/sqlite-runs-repository';

export { RunsService };
export type { UpdateRunDetails } from './application/ports';
export { runsMigrations } from './infrastructure/migrations';
export { registerRunsRoutes } from './http/routes';

export function createRunsService(db: SqlDatabase): RunsService {
  const repository = new SqliteRunsRepository(db);
  return new RunsService(repository);
}
