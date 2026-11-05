import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadgenRecordSchema,
  loadgenSummarySchema,
  type LoadgenConfig,
  type LoadgenRecord,
  type LoadgenSummary,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { LoadgenHandle, LoadgenSupervisorPort } from '../application/ports';
import { isProcessAlive, killProcessTree } from './process-tree';

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

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(currentDir);
const loadgenMainPath = join(repoRoot, 'apps', 'loadgen', 'src', 'main.ts');

export class LoadgenSupervisor implements LoadgenSupervisorPort {
  spawnLoadgen(
    config: LoadgenConfig,
    onRecord?: (record: LoadgenRecord) => void,
  ): Promise<LoadgenHandle> {
    const args = ['--import', 'tsx', loadgenMainPath, '--config', JSON.stringify(config)];

    let child: ChildProcess;
    try {
      child = spawn(process.execPath, args, {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('internal', 'loadgen_spawn_failed', `Failed to spawn loadgen: ${msg}`, {
        cause: err,
      });
    }

    const pid = child.pid;
    if (pid === undefined) {
      throw new AppError('internal', 'loadgen_missing_pid', 'Loadgen process has no PID.');
    }

    const processState: {
      running: boolean;
      exitCode: number | null;
      exitSignal: NodeJS.Signals | null;
    } = {
      running: true,
      exitCode: null,
      exitSignal: null,
    };

    const logChunks: string[] = [];
    const records: LoadgenRecord[] = [];
    let summary: LoadgenSummary | null = null;
    let lineBuffer = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('SUMMARY:')) {
        const jsonStr = trimmed.slice('SUMMARY:'.length);
        try {
          summary = loadgenSummarySchema.parse(JSON.parse(jsonStr));
        } catch {
          // Fall through
        }
        return;
      }

      try {
        const parsed = loadgenRecordSchema.parse(JSON.parse(trimmed));
        records.push(parsed);
        if (onRecord) {
          onRecord(parsed);
        }
      } catch {
        // Non-record stdout line
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      logChunks.push(text);
      lineBuffer += text;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        handleLine(line);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      logChunks.push(chunk.toString('utf8'));
    });

    child.on('exit', (code, signal) => {
      processState.running = false;
      processState.exitCode = code;
      processState.exitSignal = signal;
      if (lineBuffer.trim()) {
        handleLine(lineBuffer.trim());
        lineBuffer = '';
      }
    });

    const getLogs = () => logChunks.join('');

    const waitForCompletion = async (
      timeoutMs = config.warmupDurationMs +
        config.measurementDurationMs +
        config.cooldownDurationMs +
        config.clientTimeoutMs +
        5000,
    ): Promise<{ records: LoadgenRecord[]; summary: LoadgenSummary }> => {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline && (processState.running || isProcessAlive(pid))) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }

      if (isProcessAlive(pid)) {
        await killProcessTree(pid);
        throw new AppError(
          'internal',
          'loadgen_timeout',
          `Loadgen process failed to complete within ${String(timeoutMs)}ms. Logs: ${getLogs()}`,
        );
      }

      if (summary === null) {
        throw new AppError(
          'internal',
          'loadgen_missing_summary',
          `Loadgen process exited without emitting a valid summary. Exit code: ${String(processState.exitCode)}. Logs: ${getLogs()}`,
        );
      }

      return { records, summary };
    };

    const stop = async () => {
      if (!processState.running && !isProcessAlive(pid)) {
        return;
      }
      await killProcessTree(pid);
      processState.running = false;
    };

    const forceKill = async () => {
      await killProcessTree(pid);
      processState.running = false;
    };

    return Promise.resolve({
      pid,
      getLogs,
      isRunning: () => processState.running && isProcessAlive(pid),
      waitForCompletion,
      stop,
      forceKill,
    });
  }
}
