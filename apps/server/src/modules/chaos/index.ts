import { ChaosService, type ChaosServiceOptions } from './application/chaos-service';
import { ToxiproxyClient } from './infrastructure/toxiproxy-client';
import type { ToxiproxyClientPort } from './application/ports';

export { ChaosService };
export type { ChaosServiceOptions, ToxiproxyClientPort };
export { mapFaultToToxic } from './domain/toxic-mapping';
export type { ToxiproxyToxicRequest } from './domain/toxic-mapping';

export function createChaosService(
  toxiproxyUrl?: string,
  options?: ChaosServiceOptions,
  customClient?: ToxiproxyClientPort,
): ChaosService {
  const client = customClient ?? new ToxiproxyClient(toxiproxyUrl);
  return new ChaosService(client, options);
}
