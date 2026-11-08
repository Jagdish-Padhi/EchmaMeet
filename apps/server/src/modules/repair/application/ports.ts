import type {
  Invariant,
  RepairPatch,
  RepairSessionRecord,
  RunEvent,
  RunId,
  RunRecord,
  StartRepairRequest,
  Topology,
} from '@chaosboard/contracts';
import type { ModelCallMetadata } from '../../reasoning';

export interface ProposeRepairParams {
  topology: Topology;
  record: RunRecord;
  invariants: readonly Invariant[];
  iterationIndex: number;
  signal?: AbortSignal | undefined;
}

export interface ProposeRepairResult {
  patch: RepairPatch | null;
  rawOutput: string | null;
  metadata: ModelCallMetadata | null;
  error?: string | null | undefined;
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
