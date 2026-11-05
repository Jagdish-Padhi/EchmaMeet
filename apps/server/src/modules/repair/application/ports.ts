import type {
  Invariant,
  RepairIterationRecord,
  RepairPatch,
  RepairSessionRecord,
  RunEvent,
  RunId,
  RunRecord,
  StartRepairRequest,
  Topology,
} from '@chaosboard/contracts';
import type { ModelCallMetadata } from '../../meta-ai';

export interface ProposeRepairParams {
  topology: Topology;
  record: RunRecord;
  invariants: readonly Invariant[];
  iterationIndex: number;
  /** Every earlier iteration of this session: what was tried and what the sandbox decided. */
  history?: readonly RepairIterationRecord[] | undefined;
  signal?: AbortSignal | undefined;
}

export interface ProposeRepairResult {
  patch: RepairPatch | null;
  rawOutput: string | null;
  metadata: ModelCallMetadata | null;
  error?: string | null | undefined;
  /** How the proposal was produced; recorded in the session so reports stay honest. */
  mode?: 'tool_agent' | 'single_shot' | 'rule_based' | 'ml' | undefined;
  /** Ordered tool trace when mode is tool_agent. */
  trace?: readonly { tool: string; args: unknown; result: string }[] | undefined;
}

export interface RepairProposerPort {
  propose(params: ProposeRepairParams): Promise<ProposeRepairResult>;
}

export interface RepairOrchestratorPort {
  start(request: StartRepairRequest): Promise<RunId>;
  getRepair(repairId: RunId): RepairSessionRecord | null;
  cancel(repairId: RunId): Promise<void>;
  subscribe(repairId: RunId, listener: (event: RunEvent) => void): () => void;
}
