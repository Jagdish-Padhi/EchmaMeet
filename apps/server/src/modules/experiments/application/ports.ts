import type {
  Fault,
  Invariant,
  InvariantVerdict,
  LoadgenConfig,
  NetworkPlan,
  RunEvent,
  RunId,
  RunRecord,
  RunStatus,
  StartExperimentRequest,
  Topology,
  TrialAggregate,
  TrialResult,
  VerdictStatus,
} from '@chaosboard/contracts';
import type { SandboxHandle, LoadgenHandle } from '../../sandbox';
import type { BuildTrialResultParams } from '../../measurement';
import type { UpdateRunDetails } from '../../runs';

export interface ExperimentOrchestratorPort {
  start(request: StartExperimentRequest): Promise<RunId>;
  cancel(runId: RunId): Promise<void>;
  subscribe(runId: RunId, listener: (event: RunEvent) => void): () => void;
  isBusy(): boolean;
}

export interface EventBroadcasterPort {
  subscribe(runId: RunId, listener: (event: RunEvent) => void): () => void;
  broadcast(event: RunEvent): void;
}

export interface RunsPort {
  createRun(run: RunRecord): void;
  updateRunStatus(id: RunId, status: RunStatus, details?: UpdateRunDetails): void;
  appendEvent(event: RunEvent): void;
  appendTrial(runId: RunId, phase: 'baseline' | 'faulted', trialResult: TrialResult): void;
  getRun(id: RunId): RunRecord | null;
  getEvents(runId: RunId): RunEvent[];
}

export interface ChaosPort {
  createProxiesForPlan(plan: NetworkPlan, edgeTargets: ReadonlyMap<string, number>): Promise<void>;
  applyFault(fault: Fault): Promise<void>;
  clearFault(fault: Fault): Promise<void>;
  teardown(): Promise<void>;
}

export interface SandboxPort {
  allocateNetworkPlan(
    topology: Topology,
    options?: { baseNodePort?: number; baseProxyPort?: number },
  ): NetworkPlan;
  startSandbox(
    topology: Topology,
    plan?: NetworkPlan,
    options?: { baseNodePort?: number; baseProxyPort?: number; useProxies?: boolean },
  ): Promise<SandboxHandle>;
  startLoadgen(config: LoadgenConfig): Promise<LoadgenHandle>;
}

export interface MeasurementPort {
  buildTrialResult(params: BuildTrialResultParams): TrialResult;
  aggregateTrials(trials: readonly TrialResult[]): TrialAggregate;
  evaluateInvariantVerdict(params: {
    invariant: Invariant;
    baselineAggregate: TrialAggregate;
    faultedAggregate: TrialAggregate;
    baselineTrials?: readonly TrialResult[];
    faultedTrials?: readonly TrialResult[];
  }): InvariantVerdict;
  computeOverallStatus(verdicts: readonly InvariantVerdict[]): VerdictStatus;
}
