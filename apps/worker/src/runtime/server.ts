import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import type {
  EdgeId,
  NodeConfig,
  SamplePoint,
  WorkerCounters,
  WorkerSeries,
  WorkerStatus,
} from '@chaosboard/contracts';
import { createSeededRandom, type Clock, type RandomSource } from '@chaosboard/shared';
import { BoundedQueueManager } from '../policy/bounded-queue';
import { TokenBucketRateLimiter } from '../policy/rate-limiter';
import { InProcessCache } from './kinds/cache';
import { LedgerSinkStore } from './kinds/ledger-sink';
import { QueueConsumerWorker } from './kinds/queue-consumer';
import { simulateProcessing } from './kinds/service';
import { EdgeClient } from './client';

class DefaultClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
  monotonicNs(): bigint {
    return process.hrtime.bigint();
  }
}

export class WorkerServer {
  private readonly clock: Clock;
  private readonly random: RandomSource;
  private readonly server: Server;
  private readonly histogram: IntervalHistogram;
  private readonly queueManager: BoundedQueueManager;
  private readonly rateLimiter: TokenBucketRateLimiter | null = null;
  private readonly edgeClients: Map<string, EdgeClient> = new Map();
  private readonly cacheStore: InProcessCache | null = null;
  private readonly ledgerStore: LedgerSinkStore | null = null;
  private readonly queueConsumer: QueueConsumerWorker | null = null;

  private sampleTimer: NodeJS.Timeout | null = null;
  private readonly samples: SamplePoint[] = [];
  private readonly waitingRequests: Array<() => void> = [];
  private readonly startedAtMs: number;

  // Monotonic counters
  private requestsIn = 0;
  private readonly attemptsOut: Record<EdgeId, number> = {};
  private retries = 0;
  private timeouts = 0;
  private errorsByClass: Record<string, number> = {};
  private readonly breakerTransitions: Record<EdgeId, number> = {};
  private shedRequests = 0;

  constructor(
    public readonly config: NodeConfig,
    clock?: Clock,
    random?: RandomSource,
  ) {
    this.clock = clock ?? new DefaultClock();
    this.random = random ?? createSeededRandom(config.seed);
    this.startedAtMs = this.clock.nowMs();

    this.histogram = monitorEventLoopDelay({ resolution: 10 });

    const maxQueue = config.node.queue.mode === 'bounded' ? config.node.queue.maxDepth : null;
    this.queueManager = new BoundedQueueManager(config.node.concurrency.maxWorkers, maxQueue);

    if (config.node.ingressRateLimitRps !== null) {
      this.rateLimiter = new TokenBucketRateLimiter(config.node.ingressRateLimitRps, this.clock);
    }

    if (config.node.kind === 'cache') {
      this.cacheStore = new InProcessCache(config.node.ttlMs);
    } else if (config.node.kind === 'ledger_sink') {
      this.ledgerStore = new LedgerSinkStore(config.node.dedupeByKey);
    } else if (config.node.kind === 'queue_consumer') {
      this.queueConsumer = new QueueConsumerWorker(config.node.consumeRateRps, async (item) => {
        await this.processItemDownstream(
          item.requestId,
          item.attemptIndex,
          item.idempotencyKey,
          item.payload,
        );
      });
    }

    for (const edge of config.outgoingEdges) {
      this.attemptsOut[edge.edgeId] = 0;
      this.breakerTransitions[edge.edgeId] = 0;

      const client = new EdgeClient(edge, this.clock, this.random, (event) => {
        if (event.type === 'attempt') {
          this.attemptsOut[edge.edgeId] = (this.attemptsOut[edge.edgeId] ?? 0) + 1;
        } else if (event.type === 'retry') {
          this.retries++;
        } else if (event.type === 'timeout') {
          this.timeouts++;
        } else if (event.type === 'error' && event.errorClass) {
          this.errorsByClass[event.errorClass] = (this.errorsByClass[event.errorClass] ?? 0) + 1;
        } else if (event.type === 'breaker_transition') {
          this.breakerTransitions[edge.edgeId] = (this.breakerTransitions[edge.edgeId] ?? 0) + 1;
        }
      });
      this.edgeClients.set(edge.edgeId, client);
    }

    this.server = createServer((req, res) => {
      void this.handleIncoming(req, res);
    });
  }

  async start(): Promise<void> {
    this.histogram.enable();
    if (this.queueConsumer) {
      this.queueConsumer.start();
    }

    this.sampleTimer = setInterval(() => {
      this.takeSample();
    }, this.config.sampleIntervalMs);
    this.sampleTimer.unref();

    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.listenPort, this.config.listenHost, () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.sampleTimer !== null) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }

    if (this.queueConsumer) {
      this.queueConsumer.stop();
    }

    this.histogram.disable();

    for (const client of this.edgeClients.values()) {
      await client.close();
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  getCounters(): WorkerCounters {
    const duplicates = this.ledgerStore ? this.ledgerStore.getDuplicateCount() : 0;
    return {
      requestsIn: this.requestsIn,
      attemptsOut: { ...this.attemptsOut },
      retries: this.retries,
      timeouts: this.timeouts,
      errorsByClass: { ...this.errorsByClass },
      breakerTransitions: { ...this.breakerTransitions },
      shedRequests: this.shedRequests,
      ledgerDuplicates: duplicates,
    };
  }

  getSeries(): WorkerSeries {
    return {
      nodeId: this.config.nodeId,
      intervalMs: this.config.sampleIntervalMs,
      samples: [...this.samples],
    };
  }

  getStatus(): WorkerStatus {
    const minMs = this.histogram.min === 0 ? 0 : this.histogram.min / 1_000_000;
    const maxMs = this.histogram.max / 1_000_000;
    const meanMs = Number.isNaN(this.histogram.mean) ? 0 : this.histogram.mean / 1_000_000;
    const p50Ms = this.histogram.percentile(50) / 1_000_000;
    const p90Ms = this.histogram.percentile(90) / 1_000_000;
    const p99Ms = this.histogram.percentile(99) / 1_000_000;

    return {
      status: 'ready',
      nodeId: this.config.nodeId,
      kind: this.config.node.kind,
      listenPort: this.config.listenPort,
      uptimeMs: Math.max(0, this.clock.nowMs() - this.startedAtMs),
      eventLoopDelay: {
        minMs: Math.round(minMs * 100) / 100,
        maxMs: Math.round(maxMs * 100) / 100,
        meanMs: Math.round(meanMs * 100) / 100,
        p50Ms: Math.round(p50Ms * 100) / 100,
        p90Ms: Math.round(p90Ms * 100) / 100,
        p99Ms: Math.round(p99Ms * 100) / 100,
      },
    };
  }

  resetCounters(): { status: 'ok'; resetAtMs: number } {
    this.requestsIn = 0;
    for (const key of Object.keys(this.attemptsOut) as EdgeId[]) {
      this.attemptsOut[key] = 0;
    }
    this.retries = 0;
    this.timeouts = 0;
    this.errorsByClass = {};
    for (const key of Object.keys(this.breakerTransitions) as EdgeId[]) {
      this.breakerTransitions[key] = 0;
    }
    this.shedRequests = 0;
    this.samples.length = 0;
    if (this.ledgerStore) {
      this.ledgerStore.reset();
    }
    this.histogram.reset();

    return { status: 'ok', resetAtMs: this.clock.nowMs() };
  }

  private takeSample(): void {
    const sample: SamplePoint = {
      timestampMs: this.clock.nowMs(),
      queueDepth: this.queueManager.getQueueDepth(),
      busyWorkers: this.queueManager.getActiveWorkers(),
    };
    this.samples.push(sample);
    if (this.samples.length > 5000) {
      this.samples.shift();
    }
  }

  private async handleIncoming(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    // -------------------------------------------------------------------------
    // Control Endpoints (separate control path, bypass concurrency/queue)
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/control/')) {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET' && pathname === '/control/status') {
        res.statusCode = 200;
        res.end(JSON.stringify(this.getStatus()));
        return;
      }
      if (req.method === 'GET' && pathname === '/control/counters') {
        res.statusCode = 200;
        res.end(JSON.stringify(this.getCounters()));
        return;
      }
      if (req.method === 'GET' && pathname === '/control/series') {
        res.statusCode = 200;
        res.end(JSON.stringify(this.getSeries()));
        return;
      }
      if (req.method === 'POST' && pathname === '/control/reset') {
        res.statusCode = 200;
        res.end(JSON.stringify(this.resetCounters()));
        return;
      }
      if (req.method === 'POST' && pathname === '/control/shutdown') {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'shutting_down' }));
        setImmediate(() => {
          void this.stop();
        });
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Control endpoint not found' }));
      return;
    }

    // -------------------------------------------------------------------------
    // Data Request Path (/request or /enqueue or root)
    // -------------------------------------------------------------------------
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? `req-${String(Date.now())}`;
    const attemptIndex = parseInt(
      (req.headers['x-attempt-index'] as string | undefined) ?? '1',
      10,
    );
    const idempotencyKey = (req.headers['x-idempotency-key'] as string | undefined) ?? null;

    // Ingress rate limit
    if (this.rateLimiter !== null && !this.rateLimiter.tryAcquire()) {
      this.errorsByClass['429'] = (this.errorsByClass['429'] ?? 0) + 1;
      res.statusCode = 429;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    this.requestsIn++;

    // For queue consumers receiving an asynchronous enqueue:
    if (pathname === '/enqueue' && this.queueConsumer !== null) {
      const body = await this.readBody(req);
      this.queueConsumer.enqueue({
        requestId,
        attemptIndex,
        idempotencyKey,
        payload: body,
        enqueuedAtMs: this.clock.nowMs(),
      });
      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ enqueued: true }));
      return;
    }

    // Concurrency & queueing gate
    const gate = this.queueManager.tryAcquire();
    if (gate.status === 'rejected_full') {
      this.shedRequests++;
      this.errorsByClass['503'] = (this.errorsByClass['503'] ?? 0) + 1;
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Service Unavailable: Queue full' }));
      return;
    }

    if (gate.status === 'queued') {
      await new Promise<void>((resolve) => {
        this.waitingRequests.push(resolve);
      });
    }

    try {
      const body = await this.readBody(req);
      await this.executeNodeLogic(requestId, attemptIndex, idempotencyKey, body, res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      this.errorsByClass['500'] = (this.errorsByClass['500'] ?? 0) + 1;
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: msg }));
      }
    } finally {
      const promoted = this.queueManager.release();
      if (promoted) {
        const next = this.waitingRequests.shift();
        next?.();
      }
    }
  }

  private async executeNodeLogic(
    requestId: string,
    attemptIndex: number,
    idempotencyKey: string | null,
    payload: unknown,
    res: ServerResponse,
  ): Promise<void> {
    const kind = this.config.node.kind;

    if (kind === 'cache' && this.cacheStore !== null) {
      const lookup = this.cacheStore.get(requestId, this.clock.nowMs());
      if (lookup.hit) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ cached: true, value: lookup.value }));
        return;
      }

      await simulateProcessing(this.config.node.processing, this.random);
      const downstreamResult = await this.processItemDownstream(
        requestId,
        attemptIndex,
        idempotencyKey,
        payload,
      );

      if (downstreamResult.success) {
        this.cacheStore.set(requestId, downstreamResult.body, this.clock.nowMs());
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(downstreamResult.body);
      } else {
        res.statusCode = downstreamResult.status;
        res.setHeader('content-type', 'application/json');
        res.end(downstreamResult.body);
      }
      return;
    }

    if (kind === 'ledger_sink' && this.ledgerStore !== null) {
      const writeResult = this.ledgerStore.recordWrite(
        requestId,
        idempotencyKey,
        this.clock.nowMs(),
      );
      await simulateProcessing(this.config.node.processing, this.random);

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          committed: !writeResult.duplicate,
          duplicate: writeResult.duplicate,
          nodeId: this.config.nodeId,
        }),
      );
      return;
    }

    // Default service
    await simulateProcessing(this.config.node.processing, this.random);
    const downstream = await this.processItemDownstream(
      requestId,
      attemptIndex,
      idempotencyKey,
      payload,
    );

    res.statusCode = downstream.status;
    res.setHeader('content-type', 'application/json');
    res.end(downstream.body);
  }

  private async processItemDownstream(
    requestId: string,
    attemptIndex: number,
    idempotencyKey: string | null,
    payload: unknown,
  ): Promise<{ success: boolean; status: number; body: string }> {
    if (this.edgeClients.size === 0) {
      return {
        success: true,
        status: 200,
        body: JSON.stringify({ ok: true, nodeId: this.config.nodeId }),
      };
    }

    let overallSuccess = true;
    let worstStatus = 200;
    const results: Record<string, unknown> = {};

    for (const [edgeId, client] of this.edgeClients.entries()) {
      const edgeRes = await client.send({
        requestId,
        attemptIndex,
        idempotencyKey,
        payload,
        getStaleCache: () => {
          if (this.cacheStore) {
            const staleLookup = this.cacheStore.get(requestId, this.clock.nowMs());
            return staleLookup.value;
          }
          return undefined;
        },
      });

      results[edgeId] = edgeRes.body;
      if (!edgeRes.success) {
        overallSuccess = false;
        worstStatus = edgeRes.status;
      }
    }

    return {
      success: overallSuccess,
      status: overallSuccess ? 200 : worstStatus,
      body: JSON.stringify({
        ok: overallSuccess,
        nodeId: this.config.nodeId,
        downstream: results,
      }),
    };
  }

  private async readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(text));
        } catch {
          resolve(text);
        }
      });
    });
  }
}
