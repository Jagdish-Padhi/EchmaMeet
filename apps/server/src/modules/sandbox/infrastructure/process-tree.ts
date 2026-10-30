import { spawnSync } from 'node:child_process';

/**
 * Checks whether a process with the given PID is still alive.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    return code === 'EPERM';
  }
}

/**
 * Forcefully terminates a process and all its child processes on the current OS.
 * On Windows, uses `taskkill /pid <pid> /T /F`.
 * On Unix, uses process group signals or SIGKILL.
 */
export async function killProcessTree(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      // Ignored if already dead
    }
  } else {
    try {
      // Try killing the process group first
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Ignored if already dead
      }
    }
  }

  // Verify process is terminated
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}
