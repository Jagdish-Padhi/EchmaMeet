import type { ToxiproxyToxicRequest } from '../domain/toxic-mapping';

export interface ToxiproxyClientPort {
  getVersion(): Promise<string>;
  createProxy(name: string, listen: string, upstream: string): Promise<{ listen: string }>;
  deleteProxy(name: string): Promise<void>;
  disableProxy(name: string): Promise<void>;
  enableProxy(name: string): Promise<void>;
  addToxic(proxyName: string, toxic: ToxiproxyToxicRequest): Promise<void>;
  removeToxic(proxyName: string, toxicName: string): Promise<void>;
  reset(): Promise<void>;
}
