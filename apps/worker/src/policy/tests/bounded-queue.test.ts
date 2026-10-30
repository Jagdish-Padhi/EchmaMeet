import { describe, expect, it } from 'vitest';
import { BoundedQueueManager } from '../bounded-queue';

describe('BoundedQueueManager', () => {
  it('acquires immediately until maxWorkers is reached', () => {
    const queue = new BoundedQueueManager(2, 3);
    expect(queue.tryAcquire()).toEqual({ status: 'acquired' });
    expect(queue.getActiveWorkers()).toBe(1);
    expect(queue.getQueueDepth()).toBe(0);

    expect(queue.tryAcquire()).toEqual({ status: 'acquired' });
    expect(queue.getActiveWorkers()).toBe(2);
    expect(queue.getQueueDepth()).toBe(0);
  });

  it('queues tasks up to maxQueueDepth, then rejects', () => {
    const queue = new BoundedQueueManager(1, 2);
    expect(queue.tryAcquire()).toEqual({ status: 'acquired' });

    expect(queue.tryAcquire()).toEqual({ status: 'queued', queueDepth: 1 });
    expect(queue.tryAcquire()).toEqual({ status: 'queued', queueDepth: 2 });

    // 3rd queued task should be rejected (maxDepth = 2)
    expect(queue.tryAcquire()).toEqual({ status: 'rejected_full' });
  });

  it('promotes queued tasks on release', () => {
    const queue = new BoundedQueueManager(1, 2);
    queue.tryAcquire(); // active 1
    queue.tryAcquire(); // queue 1
    queue.tryAcquire(); // queue 2

    expect(queue.getActiveWorkers()).toBe(1);
    expect(queue.getQueueDepth()).toBe(2);

    // Release active worker: should promote 1 from queue
    const promoted1 = queue.release();
    expect(promoted1).toBe(true);
    expect(queue.getQueueDepth()).toBe(1);

    const promoted2 = queue.release();
    expect(promoted2).toBe(true);
    expect(queue.getQueueDepth()).toBe(0);

    // Release when queue is empty: active worker slot freed
    const promoted3 = queue.release();
    expect(promoted3).toBe(false);
    expect(queue.getActiveWorkers()).toBe(0);
  });

  it('never rejects when queue is unbounded (null maxDepth)', () => {
    const queue = new BoundedQueueManager(1, null);
    queue.tryAcquire(); // active 1

    for (let i = 1; i <= 100; i++) {
      expect(queue.tryAcquire()).toEqual({ status: 'queued', queueDepth: i });
    }
  });
});

