import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeConfig } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { WorkerProcessHandle, WorkerProcessSupervisorPort } from '../application/ports';
import { isProcessAlive, killProcessTree } from './process-tree';
import { WorkerControlClient } from './worker-control-client';

export type { WorkerProcessHandle };

function findRepoRoot(startDir: string): string {
  let cur = startDir;
  while (cur !== dirname(cur)) {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) {
      return cur;
    }
    cur = dirname(cur);
  }
  return cur;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(currentDir);
const workerMainPath = join(repoRoot, 'apps', 'worker', 'src', 'main.ts');

export class WorkerProcessSupervisor implements WorkerProcessSupervisorPort {
  constructor(private readonly controlClient = new WorkerControlClient()) {}

  async spawnWorker(config: NodeConfig, readinessTimeoutMs = 10_000): Promise<WorkerProcessHandle> {
    const args = ['--import', 'tsx', workerMainPath, '--config', JSON.stringify(config)];

    let child: ChildProcess;
    try {
      child = spawn(process.execPath, args, {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(
        'internal',
        'worker_spawn_failed',
        `Failed to spawn worker for node ${config.nodeId}: ${msg}`,
      );
    }

    const pid = child.pid;
    if (pid === undefined) {
      throw new AppError(
        'internal',
        'worker_missing_pid',
        `Worker process for node ${config.nodeId} has no PID.`,
      );
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

    child.stdout?.on('data', (chunk: Buffer) => {
      logChunks.push(chunk.toString('utf8'));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      logChunks.push(chunk.toString('utf8'));
    });

    child.on('exit', (code, signal) => {
      processState.running = false;
      processState.exitCode = code;
      processState.exitSignal = signal;
    });

    const getLogs = () => logChunks.join('');

    // Wait for readiness with deadline
    const deadline = Date.now() + readinessTimeoutMs;
    let isReady = false;

    while (Date.now() < deadline) {
      if (!processState.running) {
        const exitInfo =
          processState.exitCode !== null
            ? `code ${String(processState.exitCode)}`
            : `signal ${String(processState.exitSignal)}`;
        throw new AppError(
          'internal',
          'worker_unexpected_exit',
          `Worker process for node ${config.nodeId} exited unexpectedly with ${exitInfo} during startup. Logs: ${getLogs()}`,
        );
      }

      try {
        await this.controlClient.getStatus(config.listenHost, config.listenPort, 500);
        isReady = true;
        break;
      } catch {
        // Still warming up
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }

    if (!isReady) {
      await killProcessTree(pid);
      throw new AppError(
        'internal',
        'worker_readiness_timeout',
        `Worker process for node ${config.nodeId} failed to report ready within ${String(readinessTimeoutMs)} ms. Logs: ${getLogs()}`,
      );
    }

    const stop = async () => {
      if (!processState.running && !isProcessAlive(pid)) {
        return;
      }

      try {
        // Attempt graceful control shutdown
        await this.controlClient.shutdown(config.listenHost, config.listenPort, 1000);
      } catch {
        // Fall back to forced kill
      }

      // Wait briefly for process to exit cleanly
      const shutdownDeadline = Date.now() + 1000;
      while (Date.now() < shutdownDeadline && isProcessAlive(pid)) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }

      // If still alive, terminate process tree
      if (isProcessAlive(pid)) {
        await killProcessTree(pid);
      }
      processState.running = false;
    };

    const forceKill = async () => {
      await killProcessTree(pid);
      processState.running = false;
    };

    return {
      config,
      pid,
      getLogs,
      isRunning: () => processState.running && isProcessAlive(pid),
      stop,
      forceKill,
    };
  }
}
