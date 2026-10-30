import { cpus, totalmem, freemem, platform, arch } from 'node:os';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topologySchema, type Topology, type LoadgenConfig } from '@chaosboard/contracts';
import { startSandbox } from '../modules/sandbox';
import { startLoadgen } from '../modules/sandbox';

interface CalibrationResult {
  date: string;
  host: {
    cpuModel: string;
    cpuCores: number;
    totalMemoryGb: number;
    freeMemoryGb: number;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  steps: Array<{
    rateRps: number;
    completed: number;
    p99LatencyMs: number | null;
    p99LagMs: number;
    maxLagMs: number;
  }>;
  stableCapacityRps: number;
  recommendedScenarioCapRps: number;
}

export async function runCalibration(): Promise<CalibrationResult> {
  const cpuList = cpus();
  const cpuModel = cpuList[0]?.model ?? 'Unknown CPU';
  const cpuCores = cpuList.length;
  const totalMemoryGb = Math.round((totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
  const freeMemoryGb = Math.round((freemem() / (1024 * 1024 * 1024)) * 10) / 10;

  process.stdout.write(
    `Calibrating host: ${cpuModel} (${String(cpuCores)} cores, ${String(totalMemoryGb)}GB RAM)\n`,
  );

  // Trivial single-node topology
  const topology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'calibration-topo',
    name: 'Calibration Topology',
    source: 'scenario',
    entry: { nodeId: 'echo' },
    nodes: [
      {
        id: 'echo',
        label: 'Echo Service',
        kind: 'service',
        processing: { distribution: 'constant', ms: 1 },
        concurrency: { maxWorkers: 50 },
        queue: { mode: 'bounded', maxDepth: 1000 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [],
  });

  const sandbox = await startSandbox(topology, undefined, {
    baseNodePort: 22900,
    baseProxyPort: 28900,
    useProxies: false,
  });

  const echoNode = topology.nodes[0];
  if (!echoNode) {
    await sandbox.stop();
    throw new Error('Echo node definition missing in topology');
  }

  const echoConfig = sandbox.configs.get(echoNode.id);
  if (!echoConfig) {
    await sandbox.stop();
    throw new Error('Echo config not found in sandbox');
  }

  const targetUrl = `http://${echoConfig.listenHost}:${String(echoConfig.listenPort)}/request`;
  const rates = [50, 100, 200];
  const steps: CalibrationResult['steps'] = [];
  let stableCapacityRps = 50;

  try {
    for (const rate of rates) {
      process.stdout.write(`Testing arrival rate: ${String(rate)} RPS... `);
      const loadConfig: LoadgenConfig = {
        targetUrl,
        arrivalProcess: 'constant',
        arrivalRateRps: rate,
        warmupDurationMs: 200,
        measurementDurationMs: 1000,
        cooldownDurationMs: 100,
        clientTimeoutMs: 1000,
        seed: 42 + rate,
        requestIdPrefix: `cal-${String(rate)}`,
        method: 'POST',
      };

      const handle = await startLoadgen(loadConfig);
      const { records, summary } = await handle.waitForCompletion();

      const measurementDurations = records
        .filter((r) => r.phase === 'measurement' && r.durationMs !== null)
        .map((r) => r.durationMs as number)
        .sort((a, b) => a - b);

      const p99 =
        measurementDurations.length > 0
          ? (measurementDurations[Math.floor(measurementDurations.length * 0.99)] ?? null)
          : null;

      process.stdout.write(
        `done (p99 latency: ${p99 !== null ? `${String(Math.round(p99))}ms` : 'none'}, p99 lag: ${String(summary.sendLag.p99Ms)}ms)\n`,
      );

      steps.push({
        rateRps: rate,
        completed: summary.totalCompleted,
        p99LatencyMs: p99 !== null ? Math.round(p99 * 100) / 100 : null,
        p99LagMs: summary.sendLag.p99Ms,
        maxLagMs: summary.sendLag.maxMs,
      });

      if (summary.sendLag.p99Ms <= 10 && (p99 === null || p99 <= 100)) {
        stableCapacityRps = rate;
      }
    }
  } finally {
    await sandbox.stop();
  }

  const recommendedScenarioCapRps = Math.floor(stableCapacityRps * 0.5);

  const result: CalibrationResult = {
    date: new Date().toISOString(),
    host: {
      cpuModel,
      cpuCores,
      totalMemoryGb,
      freeMemoryGb,
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
    },
    steps,
    stableCapacityRps,
    recommendedScenarioCapRps,
  };

  return result;
}

// CLI entry point
const isDirectCall =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('calibrate.ts') || process.argv[1].endsWith('calibrate.js'));

function findRepoRoot(startDir: string): string {
  let cur = startDir;
  while (!existsSync(join(cur, 'pnpm-workspace.yaml'))) {
    const parent = dirname(cur);
    if (parent === cur) {
      return startDir;
    }
    cur = parent;
  }
  return cur;
}

if (isDirectCall) {
  runCalibration()
    .then((result) => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const repoRoot = findRepoRoot(__dirname);
      const dataDir = join(repoRoot, 'data');
      mkdirSync(dataDir, { recursive: true });
      const outputPath = join(dataDir, 'calibration.json');
      writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
      process.stdout.write(`Calibration written to ${outputPath}\n`);
      process.stdout.write(
        `Stable capacity: ${String(result.stableCapacityRps)} RPS. Recommended scenario cap (50%): ${String(result.recommendedScenarioCapRps)} RPS.\n`,
      );
    })
    .catch((err: unknown) => {
      process.stderr.write(`Calibration failed: ${String(err)}\n`);
      process.exit(1);
    });
}
