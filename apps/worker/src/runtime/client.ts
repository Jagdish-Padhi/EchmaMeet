import type { NodeOutgoingEdge } from '@chaosboard/contracts';
import type { Clock, RandomSource } from '@chaosboard/shared';
import { Pool } from 'undici';
import { CircuitBreaker } from '../policy/circuit-breaker';
import { canRetry, computeBackoffDelayMs } from '../policy/retry';

export interface OutboundCallContext {
  readonly requestId: string;
  readonly attemptIndex: number;
  readonly idempotencyKey: string | null;
  readonly payload: unknown;
  readonly getStaleCache?: () => unknown;
}

export interface OutboundCallResult {
  readonly success: boolean;
  readonly status: number;
  readonly body: string;
  readonly fallbackApplied?: 'fail_fast_503' | 'serve_stale_cache' | 'enqueue_for_later';
}

export class EdgeClient {
  private readonly pool: Pool;
  private readonly breaker: CircuitBreaker;
  private readonly path: string;
  private readonly pendingAsyncQueue: OutboundCallContext[] = [];

  constructor(
    public readonly edge: NodeOutgoingEdge,
    clock: Clock,
    private readonly random: RandomSource,
    private readonly onCounterEvent: (event: {
      type: 'attempt' | 'retry' | 'timeout' | 'error' | 'breaker_transition';
      edgeId: string;
      errorClass?: string;
    }) => void,
  ) {
    const target = new URL(edge.targetUrl);
    this.path = target.pathname || '/request';
    this.pool = new Pool(target.origin, {
      connections: edge.policy.pool.maxConnections,
    });
    this.breaker = new CircuitBreaker(edge.policy.breaker, clock);
  }

  getBreakerOpenTimeMs(): number {
    return this.breaker.getOpenTimeMs();
  }

  getBreakerTransitions(): number {
    return this.breaker.getTransitionCount();
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  async send(context: OutboundCallContext): Promise<OutboundCallResult> {
    if (this.edge.mode === 'async_enqueue') {
      // Async enqueue: fire and forget to downstream
      void this.executeAttemptWithRetries(context, '/enqueue');
      return { success: true, status: 202, body: JSON.stringify({ enqueued: true }) };
    }

    return this.executeAttemptWithRetries(context, this.path);
  }

  private async executeAttemptWithRetries(
    context: OutboundCallContext,
    requestPath: string,
  ): Promise<OutboundCallResult> {
    const maxAttempts = this.edge.policy.retry.maxAttempts;
    let attempt = 1;
    let lastStatus = 500;
    let lastBody = '';

    while (attempt <= maxAttempts) {
      const prevBreakerTransitions = this.breaker.getTransitionCount();

      // Check circuit breaker before sending
      if (!this.breaker.canExecute()) {
        if (this.breaker.getTransitionCount() > prevBreakerTransitions) {
          this.onCounterEvent({
            type: 'breaker_transition',
            edgeId: this.edge.edgeId,
          });
        }
        return this.applyFallback(context, 503, 'Circuit breaker open');
      }

      this.onCounterEvent({ type: 'attempt', edgeId: this.edge.edgeId });

      let callResult: { ok: boolean; status: number; body: string };
      try {
        callResult = await this.doHttpRequest(context, requestPath, attempt);
      } catch (err: unknown) {
        const isTimeout =
          err instanceof Error && (err.name === 'TimeoutError' || err.message.includes('timeout'));

        if (isTimeout) {
          this.onCounterEvent({ type: 'timeout', edgeId: this.edge.edgeId });
          this.onCounterEvent({
            type: 'error',
            edgeId: this.edge.edgeId,
            errorClass: 'timeout',
          });
          callResult = { ok: false, status: 504, body: 'Gateway Timeout' };
        } else {
          const errCode = (err as { code?: string }).code ?? 'network_error';
          this.onCounterEvent({
            type: 'error',
            edgeId: this.edge.edgeId,
            errorClass: errCode,
          });
          callResult = { ok: false, status: 502, body: 'Bad Gateway' };
        }
      }

      this.breaker.recordResult(callResult.ok);
      if (this.breaker.getTransitionCount() > prevBreakerTransitions) {
        this.onCounterEvent({
          type: 'breaker_transition',
          edgeId: this.edge.edgeId,
        });
      }

      if (callResult.ok) {
        return { success: true, status: callResult.status, body: callResult.body };
      }

      lastStatus = callResult.status;
      lastBody = callResult.body;

      if (!canRetry(attempt, maxAttempts)) {
        break;
      }

      const backoffMs = computeBackoffDelayMs(attempt - 1, this.edge.policy.retry, this.random);
      this.onCounterEvent({ type: 'retry', edgeId: this.edge.edgeId });

      if (backoffMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
      }

      attempt++;
    }

    return this.applyFallback(context, lastStatus, lastBody);
  }

  private async doHttpRequest(
    context: OutboundCallContext,
    requestPath: string,
    attempt: number,
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-request-id': context.requestId,
      'x-attempt-index': String(attempt),
    };

    if (this.edge.policy.idempotency.sendKey) {
      headers['x-idempotency-key'] = context.idempotencyKey ?? context.requestId;
    }

    const requestOptions =
      this.edge.policy.timeoutMs !== null && this.edge.policy.timeoutMs > 0
        ? {
            path: requestPath,
            method: 'POST' as const,
            headers,
            body: JSON.stringify(context.payload ?? {}),
            signal: AbortSignal.timeout(this.edge.policy.timeoutMs),
          }
        : {
            path: requestPath,
            method: 'POST' as const,
            headers,
            body: JSON.stringify(context.payload ?? {}),
          };

    const res = await this.pool.request(requestOptions);

    const bodyText = await res.body.text();
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    return { ok, status: res.statusCode, body: bodyText };
  }

  private applyFallback(
    context: OutboundCallContext,
    failureStatus: number,
    failureBody: string,
  ): OutboundCallResult {
    const fallback = this.edge.policy.fallback;
    switch (fallback) {
      case 'fail_fast_503':
        return {
          success: false,
          status: 503,
          body: JSON.stringify({ error: failureBody }),
          fallbackApplied: 'fail_fast_503',
        };
      case 'serve_stale_cache': {
        const stale = context.getStaleCache?.();
        if (stale !== undefined) {
          return {
            success: true,
            status: 200,
            body: JSON.stringify({ data: stale, stale: true }),
            fallbackApplied: 'serve_stale_cache',
          };
        }
        return {
          success: false,
          status: failureStatus,
          body: JSON.stringify({ error: failureBody }),
          fallbackApplied: 'fail_fast_503',
        };
      }
      case 'enqueue_for_later':
        this.pendingAsyncQueue.push(context);
        return {
          success: true,
          status: 202,
          body: JSON.stringify({ enqueuedForLater: true }),
          fallbackApplied: 'enqueue_for_later',
        };
    }
  }
}
