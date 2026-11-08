import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { VoiceLedgerEntry, VoiceLedgerPort } from '../application/ports';
import { MemoryVoiceLedger, percentile } from '../infrastructure/memory-voice-ledger';
import { PgVoiceLedger, VOICE_LEDGER_MIGRATIONS } from '../infrastructure/pg-voice-ledger';

function entry(over: Partial<VoiceLedgerEntry> = {}): VoiceLedgerEntry {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: 'websocket',
    language: 'hi-IN',
    transcript: 'gateway se backend par latency inject karo',
    status: 'parsed',
    commandType: 'inject_fault',
    sttModel: 'prisma-v3.0',
    sttMs: 200,
    parseMs: 1,
    ttsMs: 300,
    ...over,
  };
}

function contract(
  name: string,
  make: () => Promise<VoiceLedgerPort>,
  reset?: () => Promise<void>,
): void {
  describe(`${name} voice ledger`, () => {
    let ledger: VoiceLedgerPort;
    beforeAll(async () => {
      ledger = await make();
      await reset?.();
    });
    afterAll(async () => ledger.close());

    it('records entries and returns them newest first', async () => {
      await ledger.record(entry({ transcript: 'first', createdAt: '2026-11-01T10:00:00.000Z' }));
      await ledger.record(entry({ transcript: 'second', createdAt: '2026-11-01T10:00:01.000Z' }));
      const rows = await ledger.recent(10);
      expect(rows.map((r) => r.transcript).slice(0, 2)).toEqual(['second', 'first']);
    });

    it('aggregates by language, status and command with latency percentiles', async () => {
      await ledger.record(entry({ language: 'en-IN', sttMs: 400 }));
      await ledger.record(
        entry({ language: 'hi-IN', status: 'unsupported', commandType: null, sttMs: 600 }),
      );
      await ledger.record(entry({ status: 'empty', commandType: null, sttMs: 0, ttsMs: null }));
      const a = await ledger.analytics();
      expect(a.total).toBe(5);
      expect(a.byLanguage.find((l) => l.language === 'hi-IN')?.count).toBe(4);
      expect(a.byStatus.find((s) => s.status === 'parsed')?.count).toBe(3);
      expect(a.byCommand[0]?.command).toBe('inject_fault');
      expect(a.sttLatencyMs?.p50).toBeGreaterThan(0);
      expect(a.sttLatencyMs?.p95).toBeGreaterThanOrEqual(a.sttLatencyMs?.p50 ?? 0);
      // 3 parsed of 4 non-empty
      expect(a.successRatePct).toBe(75);
    });

    it('treats a repeated id as a no-op', async () => {
      const e = entry();
      const before = (await ledger.analytics()).total;
      await ledger.record(e);
      await ledger.record(e);
      expect((await ledger.analytics()).total).toBe(before + 1);
    });
  });
}

contract('memory', () => Promise.resolve(new MemoryVoiceLedger()));

describe('percentile', () => {
  it('interpolates', () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(percentile([], 0.5)).toBe(0);
  });
});

// Real PostgreSQL: run with TEST_DATABASE_URL=postgresql://user:pw@127.0.0.1:5432/db
const url = process.env['TEST_DATABASE_URL'];
describe.skipIf(!url)('PostgreSQL migrations', () => {
  it('are idempotent and recorded', async () => {
    const a = await PgVoiceLedger.connect(url as string);
    const second = await a.migrate();
    expect(second).toEqual([]);
    expect(VOICE_LEDGER_MIGRATIONS.length).toBeGreaterThan(0);
    await a.close();
  });
});
if (url) {
  contract(
    'postgres',
    () => PgVoiceLedger.connect(url),
    async () => {
      const { Pool } = await import('pg');
      const p = new Pool({ connectionString: url });
      await p.query('TRUNCATE voice_commands');
      await p.end();
    },
  );
}
