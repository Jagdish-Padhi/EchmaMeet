import { readFileSync } from 'node:fs';
import { loadgenConfigSchema } from '@chaosboard/contracts';
import { runLoadgen } from './runner';

function readConfigArg(): string {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf('--config');
  const nextArg = configIdx !== -1 ? args[configIdx + 1] : undefined;
  if (nextArg !== undefined) {
    return nextArg;
  }

  if (args.includes('--stdin')) {
    return readFileSync(0, 'utf8');
  }

  throw new Error('Loadgen requires --config <json> or --stdin.');
}

async function main(): Promise<void> {
  const raw = readConfigArg();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Loadgen failed to parse configuration JSON: ${msg}`, { cause: err });
  }

  const config = loadgenConfigSchema.parse(json);

  const summary = await runLoadgen(config, (record) => {
    process.stdout.write(JSON.stringify(record) + '\n');
  });

  process.stdout.write('SUMMARY:' + JSON.stringify(summary) + '\n');
  process.exit(0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Loadgen fatal error: ${msg}\n`);
  process.exit(1);
});
