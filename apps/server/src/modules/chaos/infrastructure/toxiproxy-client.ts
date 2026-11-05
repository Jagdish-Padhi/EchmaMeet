import { AppError } from '@chaosboard/shared';
import type { ToxiproxyClientPort } from '../application/ports';
import type { ToxiproxyToxicRequest } from '../domain/toxic-mapping';

export class ToxiproxyClient implements ToxiproxyClientPort {
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:8474') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(5000),
    };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, init);

      if (!res.ok) {
        let errBody: string;
        try {
          errBody = await res.text();
        } catch {
          errBody = '';
        }
        throw new AppError(
          'internal',
          'toxiproxy_error',
          `HTTP ${String(res.status)} from Toxiproxy at ${path}: ${errBody}`,
        );
      }

      if (res.status === 204) {
        return undefined;
      }

      return await res.json();
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(
        'internal',
        'toxiproxy_unreachable',
        `Failed to communicate with Toxiproxy at ${url}: ${msg}`,
        { cause: err },
      );
    }
  }

  async getVersion(): Promise<string> {
    const res = (await this.request('GET', '/version')) as { version?: string };
    return res.version ?? 'unknown';
  }

  async createProxy(name: string, listen: string, upstream: string): Promise<{ listen: string }> {
    const res = (await this.request('POST', '/proxies', {
      name,
      listen,
      upstream,
      enabled: true,
    })) as { listen: string };
    return { listen: res.listen };
  }

  async deleteProxy(name: string): Promise<void> {
    try {
      await this.request('DELETE', `/proxies/${name}`);
    } catch {
      // Ignored if proxy does not exist
    }
  }

  async disableProxy(name: string): Promise<void> {
    await this.request('POST', `/proxies/${name}`, { enabled: false });
  }

  async enableProxy(name: string): Promise<void> {
    await this.request('POST', `/proxies/${name}`, { enabled: true });
  }

  async addToxic(proxyName: string, toxic: ToxiproxyToxicRequest): Promise<void> {
    await this.request('POST', `/proxies/${proxyName}/toxics`, toxic);
  }

  async removeToxic(proxyName: string, toxicName: string): Promise<void> {
    try {
      await this.request('DELETE', `/proxies/${proxyName}/toxics/${toxicName}`);
    } catch {
      // Ignored if toxic does not exist
    }
  }

  async reset(): Promise<void> {
    await this.request('POST', '/reset');
  }
}
