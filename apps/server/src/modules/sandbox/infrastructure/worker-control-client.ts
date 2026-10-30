import {
  workerCountersSchema,
  workerResetResponseSchema,
  workerSeriesSchema,
  workerShutdownResponseSchema,
  workerStatusSchema,
  type WorkerCounters,
  type WorkerResetResponse,
  type WorkerSeries,
  type WorkerShutdownResponse,
  type WorkerStatus,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { WorkerControlClientPort } from '../application/ports';

export class WorkerControlClient implements WorkerControlClientPort {
  async getStatus(host: string, port: number, timeoutMs = 2000): Promise<WorkerStatus> {
    const url = `http://${host}:${String(port)}/control/status`;
    const data = await this.httpJson(url, 'GET', undefined, timeoutMs);
    return workerStatusSchema.parse(data);
  }

  async getCounters(host: string, port: number, timeoutMs = 2000): Promise<WorkerCounters> {
    const url = `http://${host}:${String(port)}/control/counters`;
    const data = await this.httpJson(url, 'GET', undefined, timeoutMs);
    return workerCountersSchema.parse(data);
  }

  async getSeries(host: string, port: number, timeoutMs = 2000): Promise<WorkerSeries> {
    const url = `http://${host}:${String(port)}/control/series`;
    const data = await this.httpJson(url, 'GET', undefined, timeoutMs);
    return workerSeriesSchema.parse(data);
  }

  async reset(host: string, port: number, timeoutMs = 2000): Promise<WorkerResetResponse> {
    const url = `http://${host}:${String(port)}/control/reset`;
    const data = await this.httpJson(url, 'POST', {}, timeoutMs);
    return workerResetResponseSchema.parse(data);
  }

  async shutdown(host: string, port: number, timeoutMs = 2000): Promise<WorkerShutdownResponse> {
    const url = `http://${host}:${String(port)}/control/shutdown`;
    const data = await this.httpJson(url, 'POST', {}, timeoutMs);
    return workerShutdownResponseSchema.parse(data);
  }

  private async httpJson(
    url: string,
    method: string,
    body?: unknown,
    timeoutMs = 2000,
  ): Promise<unknown> {
    try {
      const init: RequestInit = {
        method,
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (body !== undefined) {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(body);
      }

      const res = await fetch(url, init);

      if (!res.ok) {
        throw new AppError(
          'internal',
          'worker_http_error',
          `HTTP ${String(res.status)} from worker control endpoint: ${url}`,
        );
      }

      return await res.json();
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(
        'internal',
        'worker_control_unreachable',
        `Failed to reach worker control at ${url}: ${msg}`,
      );
    }
  }
}
