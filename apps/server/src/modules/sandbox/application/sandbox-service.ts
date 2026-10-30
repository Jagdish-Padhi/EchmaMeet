import type {
  NetworkPlan,
  NodeId,
  Topology,
  WorkerCounters,
  WorkerSeries,
} from '@chaosboard/contracts';
import { allocateNetworkPlan } from '../domain/plan';
import { deriveNodeConfigurations } from '../domain/derive-config';
import type {
  SandboxHandle,
  SandboxStartOptions,
  WorkerControlClientPort,
  WorkerProcessHandle,
  WorkerProcessSupervisorPort,
} from './ports';

export async function startSandbox(
  supervisor: WorkerProcessSupervisorPort,
  controlClient: WorkerControlClientPort,
  topology: Topology,
  plan?: NetworkPlan,
  options?: SandboxStartOptions,
): Promise<SandboxHandle> {
  const networkPlan =
    plan ??
    allocateNetworkPlan(topology, {
      baseNodePort: options?.baseNodePort,
      baseProxyPort: options?.baseProxyPort,
    });

  const configs = deriveNodeConfigurations(topology, networkPlan, {
    useProxies: options?.useProxies ?? false,
    baseSeed: options?.baseSeed,
    sampleIntervalMs: options?.sampleIntervalMs,
  });

  const handles: WorkerProcessHandle[] = [];

  try {
    for (const config of configs.values()) {
      const handle = await supervisor.spawnWorker(config, options?.readinessTimeoutMs ?? 10_000);
      handles.push(handle);
    }
  } catch (err) {
    // Guaranteed cleanup on failure: stop any workers that were started
    await Promise.allSettled(handles.map((h) => h.stop()));
    throw err;
  }

  const handleMap = new Map<NodeId, WorkerProcessHandle>();
  for (const h of handles) {
    handleMap.set(h.config.nodeId, h);
  }

  const handle: SandboxHandle = {
    plan: networkPlan,
    configs,

    async readCounters(nodeId?: NodeId): Promise<Map<NodeId, WorkerCounters>> {
      const results = new Map<NodeId, WorkerCounters>();
      const targets =
        nodeId !== undefined
          ? [handleMap.get(nodeId)].filter((h): h is WorkerProcessHandle => h !== undefined)
          : handles;

      for (const h of targets) {
        const counters = await controlClient.getCounters(h.config.listenHost, h.config.listenPort);
        results.set(h.config.nodeId, counters);
      }
      return results;
    },

    async readSeries(nodeId?: NodeId): Promise<Map<NodeId, WorkerSeries>> {
      const results = new Map<NodeId, WorkerSeries>();
      const targets =
        nodeId !== undefined
          ? [handleMap.get(nodeId)].filter((h): h is WorkerProcessHandle => h !== undefined)
          : handles;

      for (const h of targets) {
        const series = await controlClient.getSeries(h.config.listenHost, h.config.listenPort);
        results.set(h.config.nodeId, series);
      }
      return results;
    },

    async resetCounters(): Promise<void> {
      for (const h of handles) {
        await controlClient.reset(h.config.listenHost, h.config.listenPort);
      }
    },

    async stop(): Promise<void> {
      await Promise.allSettled(handles.map((h) => h.stop()));
    },
  };

  return handle;
}
