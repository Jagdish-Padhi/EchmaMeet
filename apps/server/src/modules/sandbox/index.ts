import type { NetworkPlan, Topology } from '@chaosboard/contracts';
import { startSandbox as startSandboxApp } from './application/sandbox-service';
import type { SandboxHandle, SandboxStartOptions } from './application/ports';
import { WorkerControlClient } from './infrastructure/worker-control-client';
import { WorkerProcessSupervisor } from './infrastructure/worker-process-supervisor';

export { allocateNetworkPlan } from './domain/plan';
export type { PlanAllocationOptions } from './domain/plan';
export { deriveNodeConfigurations } from './domain/derive-config';
export type { DeriveConfigOptions } from './domain/derive-config';
export type { SandboxHandle, SandboxStartOptions } from './application/ports';

export async function startSandbox(
  topology: Topology,
  plan?: NetworkPlan,
  options?: SandboxStartOptions,
): Promise<SandboxHandle> {
  const supervisor = new WorkerProcessSupervisor();
  const controlClient = new WorkerControlClient();
  return startSandboxApp(supervisor, controlClient, topology, plan, options);
}
