import type { Fault, NetworkPlan } from '@chaosboard/contracts';
import type { ToxiproxyClientPort } from './ports';
import { mapFaultToToxic } from '../domain/toxic-mapping';

export interface ChaosServiceOptions {
  upstreamHost?: string;
}

export class ChaosService {
  private readonly client: ToxiproxyClientPort;
  private readonly upstreamHost: string;
  private readonly createdProxies = new Set<string>();

  constructor(client: ToxiproxyClientPort, options: ChaosServiceOptions = {}) {
    this.client = client;
    this.upstreamHost = options.upstreamHost ?? 'host.docker.internal';
  }

  async verifyConnection(): Promise<string> {
    return await this.client.getVersion();
  }

  getProxyName(edgeId: string): string {
    return `cb-edge-${edgeId}`;
  }

  async createProxiesForPlan(plan: NetworkPlan, edgeTargets: Map<string, number>): Promise<void> {
    for (const edgeAlloc of plan.edges) {
      const targetPort = edgeTargets.get(edgeAlloc.edgeId);
      if (targetPort === undefined) {
        continue;
      }

      const proxyName = this.getProxyName(edgeAlloc.edgeId);
      const listen = `0.0.0.0:${String(edgeAlloc.proxyPort)}`;
      const upstream = `${this.upstreamHost}:${String(targetPort)}`;

      // Delete existing proxy with same name if any
      await this.client.deleteProxy(proxyName);
      await this.client.createProxy(proxyName, listen, upstream);
      this.createdProxies.add(proxyName);
    }
  }

  async applyFault(fault: Fault): Promise<void> {
    const proxyName = this.getProxyName(fault.edgeId);
    if (fault.type === 'dependency_down') {
      await this.client.disableProxy(proxyName);
      return;
    }

    const toxic = mapFaultToToxic(fault);
    await this.client.addToxic(proxyName, toxic);
  }

  async clearFault(fault: Fault): Promise<void> {
    const proxyName = this.getProxyName(fault.edgeId);
    if (fault.type === 'dependency_down') {
      await this.client.enableProxy(proxyName);
      return;
    }

    await this.client.removeToxic(proxyName, 'chaos-fault');
  }

  async teardown(): Promise<void> {
    for (const proxyName of this.createdProxies) {
      await this.client.deleteProxy(proxyName);
    }
    this.createdProxies.clear();
  }
}
