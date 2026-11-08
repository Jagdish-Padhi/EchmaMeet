export type * from './application/ports';
export { MemoryVoiceLedger } from './infrastructure/memory-voice-ledger';
export { PgVoiceLedger, VOICE_LEDGER_MIGRATIONS } from './infrastructure/pg-voice-ledger';
export { registerVoiceLedgerRoutes } from './http/routes';
import type { VoiceLedgerPort } from './application/ports';
import { MemoryVoiceLedger } from './infrastructure/memory-voice-ledger';
import { PgVoiceLedger } from './infrastructure/pg-voice-ledger';

/**
 * Postgres (Neon) when DATABASE_URL is set; otherwise a bounded in-memory ledger. A failed
 * connection is reported to the caller instead of silently pretending Postgres is active.
 */
export async function createVoiceLedger(
  databaseUrl: string,
  onFallback?: (error: unknown) => void,
): Promise<VoiceLedgerPort> {
  if (!databaseUrl) return new MemoryVoiceLedger();
  try {
    return await PgVoiceLedger.connect(databaseUrl);
  } catch (error) {
    onFallback?.(error);
    return new MemoryVoiceLedger();
  }
}
