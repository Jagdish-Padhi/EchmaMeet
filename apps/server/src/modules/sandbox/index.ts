import type { LoadgenConfig, LoadgenRecord, NetworkPlan, Topology } from '@chaosboard/contracts';
import { startSandbox as startSandboxApp } from './application/sandbox-service';
import type {
  LoadgenHandle,
  LoadgenSupervisorPort,
  SandboxHandle,
  SandboxStartOptions,
} from './application/ports';
import { WorkerControlClient } from './infrastructure/worker-control-client';
import { WorkerProcessSupervisor } from './infrastructure/worker-process-supervisor';
import { LoadgenSupervisor } from './infrastructure/loadgen-supervisor';

export { allocateNetworkPlan } from './domain/plan';
export type { PlanAllocationOptions } from './domain/plan';
export { deriveNodeConfigurations } from './domain/derive-config';
export type { DeriveConfigOptions } from './domain/derive-config';
export type {
  LoadgenHandle,
  LoadgenSupervisorPort,
  SandboxHandle,
  SandboxStartOptions,
} from './application/ports';
export { LoadgenSupervisor } from './infrastructure/loadgen-supervisor';

export async function startSandbox(
  topology: Topology,
  plan?: NetworkPlan,
  options?: SandboxStartOptions,
): Promise<SandboxHandle> {
  const supervisor = new WorkerProcessSupervisor();
  const controlClient = new WorkerControlClient();
  return startSandboxApp(supervisor, controlClient, topology, plan, options);
}

export async function startLoadgen(
  config: LoadgenConfig,
  onRecord?: (record: LoadgenRecord) => void,
  customSupervisor?: LoadgenSupervisorPort,
): Promise<LoadgenHandle> {
  const supervisor = customSupervisor ?? new LoadgenSupervisor();
  return supervisor.spawnLoadgen(config, onRecord);
}
