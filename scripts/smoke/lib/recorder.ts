import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSecrets, createRedactor } from './redact';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export interface Observation {
  readonly step: string;
  readonly data: Record<string, unknown>;
}

/**
 * Collects what a smoke script observed and writes it, redacted, under .smoke-output/.
 * Recordings are evidence for docs/api-notes.md. They are not committed automatically.
 */
export function createRecorder(scriptName: string) {
  const observations: Observation[] = [];
  const redactor = createRedactor(collectSecrets(process.env));
  const startedAt = new Date().toISOString();

  return {
    redactor,
    add(step: string, data: Record<string, unknown>): void {
      observations.push({ step, data });
    },
    save(): string {
      const directory = join(repoRoot, '.smoke-output');
      mkdirSync(directory, { recursive: true });
      const file = join(directory, `${scriptName}-${startedAt.replace(/[:.]/g, '-')}.json`);
      const body = JSON.stringify(
        { script: scriptName, startedAt, node: process.version, observations },
        null,
        2,
      );
      writeFileSync(file, redactor.text(body));
      return file;
    },
  };
}
