import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTopologyInput } from '../application/validate-topology';

const directory = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'scenarios');
const files = readdirSync(directory).filter((name) => name.endsWith('.json'));

describe('scenario topology fixtures', () => {
  it('includes the six core scenarios', () => {
    expect(files.sort()).toEqual([
      'availability-tradeoff.json',
      'missing-timeout-cascade.json',
      'non-idempotent-retry.json',
      'oversensitive-breaker.json',
      'retry-storm.json',
      'unbounded-queue.json',
    ]);
  });

  it.each(files)('%s is a valid topology', (file) => {
    const raw: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'));
    const outcome = validateTopologyInput(raw);
    expect(outcome.valid, JSON.stringify(outcome)).toBe(true);
  });

  it.each(files)('%s is marked as a scenario source', (file) => {
    const raw: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'));
    const outcome = validateTopologyInput(raw);
    expect(outcome.valid && outcome.topology.source === 'scenario').toBe(true);
  });
});
