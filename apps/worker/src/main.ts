import { readFileSync } from 'node:fs';
import { nodeConfigSchema } from '@chaosboard/contracts';
import { WorkerServer } from './runtime/server';

function readConfigArg(): string {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf('--config');
  if (configIndex !== -1) {
    const val = args[configIndex + 1];
    if (val !== undefined) {
      return val;
    }
  }

  if (args.includes('--stdin')) {
    return readFileSync(0, 'utf8');
  }

  throw new Error('Worker requires --config <json> or --stdin.');
}

async function main(): Promise<void> {
  const raw = readConfigArg();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Worker failed to parse JSON configuration: ${msg}`, { cause: err });
  }

  const config = nodeConfigSchema.parse(json);
  const server = new WorkerServer(config);

  await server.start();

  const shutdown = async () => {
    try {
      await server.stop();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`Worker process failed to start: ${msg}\n`);
  process.exit(1);
});
