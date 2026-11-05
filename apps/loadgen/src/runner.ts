import { monitorEventLoopDelay } from 'node:perf_hooks';
import type {
  LoadgenConfig,
  LoadgenRecord,
  LoadgenSummary,
  PercentileSummary,
  EventLoopDelaySummary,
} from '@chaosboard/contracts';
import { generateSchedule, type ScheduledRequest } from './schedule';

export function calculatePercentiles(samples: number[]): PercentileSummary {
  if (samples.length === 0) {
    return { minMs: 0, maxMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p99Ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;

  const getP = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx] ?? 0;
  };

  return {
    minMs: Math.round(min * 100) / 100,
    maxMs: Math.round(max * 100) / 100,
    meanMs: Math.round(mean * 100) / 100,
    p50Ms: Math.round(getP(50) * 100) / 100,
    p90Ms: Math.round(getP(90) * 100) / 100,
    p99Ms: Math.round(getP(99) * 100) / 100,
  };
}

export async function runLoadgen(
  config: LoadgenConfig,
  onRecord: (record: LoadgenRecord) => void,
): Promise<LoadgenSummary> {
  const schedule = generateSchedule(config);
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  const lagSamples: number[] = [];
  const totalScheduled = schedule.length;
  let totalSent = 0;
  let totalCompleted = 0;
  let totalTimeouts = 0;
  let totalErrors = 0;

  const inflight = new Set<Promise<void>>();
  const startNs = process.hrtime.bigint();

  const dispatch = async (item: ScheduledRequest, targetNs: bigint, sendLagMs: number) => {
    totalSent += 1;
    const sendNs = process.hrtime.bigint();
    const actualSendOffsetMs = Number(sendNs - startNs) / 1e6;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, config.clientTimeoutMs);

    try {
      const headers: Record<string, string> = {
        'x-request-id': item.requestId,
        ...(config.headers ?? {}),
      };

      const reqInit: RequestInit = {
        method: config.method,
        headers,
        signal: controller.signal,
      };
      if (config.method === 'POST' && config.body !== undefined) {
        reqInit.body = config.body;
      }

      const res = await fetch(config.targetUrl, reqInit);

      clearTimeout(timer);
      const completedNs = process.hrtime.bigint();
      // Latency from scheduled send time to prevent coordinated omission
      const durationMs = Math.max(0, Number(completedNs - targetNs) / 1e6);
      const completedOffsetMs = Number(completedNs - startNs) / 1e6;

      let statusClass: LoadgenRecord['statusClass'];
      if (res.status >= 200 && res.status < 300) {
        statusClass = 'success_2xx';
        totalCompleted += 1;
      } else if (res.status >= 400 && res.status < 500) {
        statusClass = 'client_error_4xx';
        totalErrors += 1;
      } else {
        statusClass = 'server_error_5xx';
        totalErrors += 1;
      }

      onRecord({
        requestId: item.requestId,
        phase: item.phase,
        scheduledOffsetMs: item.scheduledOffsetMs,
        actualSendOffsetMs,
        completedOffsetMs,
        durationMs,
        sendLagMs,
        statusClass,
        httpStatus: res.status,
        errorClass: null,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isTimeout =
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
        controller.signal.aborted;

      let statusClass: LoadgenRecord['statusClass'];
      if (isTimeout) {
        statusClass = 'timeout';
        totalTimeouts += 1;
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
          statusClass = 'connect_error';
        } else {
          statusClass = 'network_error';
        }
        totalErrors += 1;
      }

      const errorClass = err instanceof Error ? err.name : 'UnknownError';

      onRecord({
        requestId: item.requestId,
        phase: item.phase,
        scheduledOffsetMs: item.scheduledOffsetMs,
        actualSendOffsetMs,
        completedOffsetMs: null,
        durationMs: null,
        sendLagMs,
        statusClass,
        httpStatus: null,
        errorClass,
      });
    }
  };

  // Open-loop timer loop with drift correction
  for (const item of schedule) {
    const targetNs = startNs + BigInt(Math.round(item.runOffsetMs * 1e6));
    const nowNs = process.hrtime.bigint();

    if (nowNs < targetNs) {
      const waitMs = Number(targetNs - nowNs) / 1e6;
      if (waitMs > 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, Math.floor(waitMs)));
      }
    }

    const currentNs = process.hrtime.bigint();
    const sendLagMs = Math.max(0, Number(currentNs - targetNs) / 1e6);
    lagSamples.push(sendLagMs);

    const promise = dispatch(item, targetNs, sendLagMs);
    inflight.add(promise);
    void promise.finally(() => {
      inflight.delete(promise);
    });
  }

  // Wait for inflight requests to settle with deadline
  const waitDeadline = Date.now() + config.clientTimeoutMs + 500;
  while (inflight.size > 0 && Date.now() < waitDeadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }

  histogram.disable();
  const endNs = process.hrtime.bigint();
  const actualDurationMs = Number(endNs - startNs) / 1e6;

  const eventLoopDelay: EventLoopDelaySummary = {
    minMs: Math.round((histogram.min / 1e6) * 100) / 100,
    maxMs: Math.round((histogram.max / 1e6) * 100) / 100,
    meanMs: Math.round((histogram.mean / 1e6) * 100) / 100,
    p50Ms: Math.round((histogram.percentile(50) / 1e6) * 100) / 100,
    p90Ms: Math.round((histogram.percentile(90) / 1e6) * 100) / 100,
    p99Ms: Math.round((histogram.percentile(99) / 1e6) * 100) / 100,
  };

  return {
    totalScheduled,
    totalSent,
    totalCompleted,
    totalTimeouts,
    totalErrors,
    actualDurationMs: Math.round(actualDurationMs * 100) / 100,
    sendLag: calculatePercentiles(lagSamples),
    eventLoopDelay,
  };
}
