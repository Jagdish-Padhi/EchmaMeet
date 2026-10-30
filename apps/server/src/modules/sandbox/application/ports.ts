import type {
  LoadgenConfig,
  LoadgenRecord,
  LoadgenSummary,
  NetworkPlan,
  NodeConfig,
  NodeId,
  WorkerCounters,
  WorkerResetResponse,
  WorkerSeries,
  WorkerShutdownResponse,
  WorkerStatus,
} from '@chaosboard/contracts';

export interface LoadgenHandle {
  readonly pid: number;
  readonly getLogs: () => string;
  readonly isRunning: () => boolean;
  readonly waitForCompletion: (timeoutMs?: number) => Promise<{
    records: LoadgenRecord[];
    summary: LoadgenSummary;
  }>;
  readonly stop: () => Promise<void>;
  readonly forceKill: () => Promise<void>;
}

export interface LoadgenSupervisorPort {
  spawnLoadgen(
    config: LoadgenConfig,
    onRecord?: (record: LoadgenRecord) => void,
  ): Promise<LoadgenHandle>;
}

export interface WorkerProcessHandle {
  readonly config: NodeConfig;
  readonly pid: number;
  readonly getLogs: () => string;
  readonly isRunning: () => boolean;
  readonly stop: () => Promise<void>;
  readonly forceKill: () => Promise<void>;
}

export interface WorkerProcessSupervisorPort {
  spawnWorker(config: NodeConfig, readinessTimeoutMs?: number): Promise<WorkerProcessHandle>;
}

export interface WorkerControlClientPort {
  getStatus(host: string, port: number, timeoutMs?: number): Promise<WorkerStatus>;
  getCounters(host: string, port: number, timeoutMs?: number): Promise<WorkerCounters>;
  getSeries(host: string, port: number, timeoutMs?: number): Promise<WorkerSeries>;
  reset(host: string, port: number, timeoutMs?: number): Promise<WorkerResetResponse>;
  shutdown(host: string, port: number, timeoutMs?: number): Promise<WorkerShutdownResponse>;
}

export interface SandboxHandle {
  readonly plan: NetworkPlan;
  readonly configs: ReadonlyMap<NodeId, NodeConfig>;
  readCounters(nodeId?: NodeId): Promise<Map<NodeId, WorkerCounters>>;
  readSeries(nodeId?: NodeId): Promise<Map<NodeId, WorkerSeries>>;
  resetCounters(): Promise<void>;
  stop(): Promise<void>;
}

export interface SandboxStartOptions {
  readonly baseNodePort?: number | undefined;
  readonly baseProxyPort?: number | undefined;
  readonly useProxies?: boolean | undefined;
  readonly readinessTimeoutMs?: number | undefined;
  readonly baseSeed?: number | undefined;
  readonly sampleIntervalMs?: number | undefined;
}
