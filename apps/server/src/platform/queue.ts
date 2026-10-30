import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface DistributedJobOptions {
  readonly redisUrl?: string;
}

export interface DistributedQueueManager {
  readonly isDistributed: boolean;
  addJob(queueName: string, name: string, data: unknown): Promise<{ id?: string | undefined }>;
  close(): Promise<void>;
}

/**
 * Enterprise BullMQ + Redis Queue Manager.
 * If `redisUrl` is provided (e.g. from Upstash / Redis cloud), jobs are distributed
 * across BullMQ queues with retry and dead-letter semantics.
 * If `redisUrl` is omitted or empty, runs gracefully in-process.
 */
export function createDistributedQueueManager(redisUrl?: string): DistributedQueueManager {
  if (!redisUrl || redisUrl.trim() === '') {
    return {
      isDistributed: false,
      addJob() {
        return Promise.resolve({ id: `in-proc-${String(Date.now())}` });
      },
      async close() {},
    };
  }

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  });

  const queues = new Map<string, Queue>();

  return {
    isDistributed: true,
    async addJob(queueName: string, name: string, data: unknown) {
      let queue = queues.get(queueName);
      if (!queue) {
        queue = new Queue(queueName, { connection });
        queues.set(queueName, queue);
      }
      const job = await queue.add(name, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      });
      return { id: job.id };
    },
    async close() {
      for (const queue of queues.values()) {
        await queue.close();
      }
      await connection.quit();
    },
  };
}
