import { describe, expect, it, vi } from 'vitest';
import { createShutdownRegistry, installProcessHandlers, type ProcessLike } from '../lifecycle';

function silentLogger() {
  return { info: vi.fn(), error: vi.fn(), fatal: vi.fn() };
}

describe('createShutdownRegistry', () => {
  it('runs cleanups in reverse registration order', async () => {
    const order: string[] = [];
    const registry = createShutdownRegistry({ logger: silentLogger(), cleanupTimeoutMs: 1000 });
    registry.register('first', () => {
      order.push('first');
    });
    registry.register('second', async () => {
      await Promise.resolve();
      order.push('second');
    });
    await registry.shutdown('test');
    expect(order).toEqual(['second', 'first']);
  });

  it('runs cleanups only once however many times shutdown is called', async () => {
    const cleanup = vi.fn();
    const registry = createShutdownRegistry({ logger: silentLogger(), cleanupTimeoutMs: 1000 });
    registry.register('once', cleanup);
    await Promise.all([registry.shutdown('a'), registry.shutdown('b')]);
    await registry.shutdown('c');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps going after a cleanup fails and logs the failure', async () => {
    const logger = silentLogger();
    const after = vi.fn();
    const registry = createShutdownRegistry({ logger, cleanupTimeoutMs: 1000 });
    registry.register('after', after);
    registry.register('failing', () => {
      throw new Error('cleanup broke');
    });
    await registry.shutdown('test');
    expect(after).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ cleanup: 'failing' }),
      'cleanup failed',
    );
  });

  it('moves on when a cleanup hangs past the timeout', async () => {
    const logger = silentLogger();
    const after = vi.fn();
    const registry = createShutdownRegistry({ logger, cleanupTimeoutMs: 20 });
    registry.register('after', after);
    registry.register('hanging', () => new Promise<void>(() => undefined));
    await registry.shutdown('test');
    expect(after).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({ cleanup: 'hanging' }, 'cleanup timed out');
  });
});

describe('installProcessHandlers', () => {
  function fakeProcess() {
    const listeners = new Map<string, (...args: never[]) => void>();
    const exit = vi.fn();
    const target: ProcessLike = {
      on(event: string, listener: (...args: never[]) => void) {
        listeners.set(event, listener);
        return target;
      },
      exit,
    };
    return { target, listeners, exit };
  }

  it('shuts down and exits with code 0 on SIGTERM', async () => {
    const { target, listeners, exit } = fakeProcess();
    const cleanup = vi.fn();
    const registry = createShutdownRegistry({ logger: silentLogger(), cleanupTimeoutMs: 1000 });
    registry.register('x', cleanup);
    installProcessHandlers(target, registry, silentLogger());
    listeners.get('SIGTERM')?.();
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('logs fatal errors, still runs cleanups, and exits non-zero', async () => {
    const { target, listeners, exit } = fakeProcess();
    const logger = silentLogger();
    const cleanup = vi.fn();
    const registry = createShutdownRegistry({ logger, cleanupTimeoutMs: 1000 });
    registry.register('x', cleanup);
    installProcessHandlers(target, registry, logger);
    (listeners.get('uncaughtException') as (error: Error) => void)(new Error('fatal'));
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(logger.fatal).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalled();
  });
});
