import type { Logger } from 'pino';

type Cleanup = () => Promise<void> | void;

interface Registered {
  readonly name: string;
  readonly cleanup: Cleanup;
}

export interface ShutdownRegistry {
  /** Cleanups run in reverse registration order. */
  register(name: string, cleanup: Cleanup): void;
  /** Runs all cleanups once. Later calls return the same completion. */
  shutdown(reason: string): Promise<void>;
}

export interface ShutdownOptions {
  readonly logger: Pick<Logger, 'info' | 'error'>;
  /** Maximum time one cleanup may take before the registry moves on. */
  readonly cleanupTimeoutMs: number;
}

export function createShutdownRegistry(options: ShutdownOptions): ShutdownRegistry {
  const registered: Registered[] = [];
  let running: Promise<void> | undefined;

  async function runOne({ name, cleanup }: Registered): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        resolve('timeout');
      }, options.cleanupTimeoutMs);
    });
    try {
      const outcome = await Promise.race([Promise.resolve().then(cleanup), timeout]);
      if (outcome === 'timeout') {
        options.logger.error({ cleanup: name }, 'cleanup timed out');
      }
    } catch (error) {
      options.logger.error({ cleanup: name, err: error }, 'cleanup failed');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    register(name, cleanup) {
      registered.push({ name, cleanup });
    },
    shutdown(reason) {
      running ??= (async () => {
        options.logger.info({ reason }, 'shutting down');
        for (const entry of [...registered].reverse()) {
          await runOne(entry);
        }
      })();
      return running;
    },
  };
}

/** The slice of `process` the signal handlers need, so tests can supply a fake. */
export interface ProcessLike {
  on(
    event: 'SIGINT' | 'SIGTERM' | 'uncaughtException' | 'unhandledRejection',
    listener: (value?: unknown) => void,
  ): unknown;
  exit(code: number): void;
}

/**
 * Wires termination signals and fatal errors to the shutdown registry. Fatal errors are logged,
 * cleanups still run so child processes and proxies are released, and the exit code is non-zero.
 */
export function installProcessHandlers(
  target: ProcessLike,
  registry: ShutdownRegistry,
  logger: Pick<Logger, 'fatal'>,
): void {
  const stop = (reason: string, code: number): void => {
    void registry.shutdown(reason).finally(() => {
      target.exit(code);
    });
  };
  target.on('SIGINT', () => {
    stop('SIGINT', 0);
  });
  target.on('SIGTERM', () => {
    stop('SIGTERM', 0);
  });
  target.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    stop('uncaughtException', 1);
  });
  target.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled rejection');
    stop('unhandledRejection', 1);
  });
}
