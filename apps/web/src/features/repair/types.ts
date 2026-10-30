import type {
  RepairIterationRecord,
  RepairProposerKind,
  RepairSessionRecord,
  RepairStatus,
  RunId,
  TradeOffReport,
} from '@chaosboard/contracts';

export interface RepairSessionState {
  readonly repairId: RunId | null;
  readonly status: RepairStatus | 'idle' | 'starting';
  readonly proposerKind: RepairProposerKind;
  readonly maxIterations: number;
  readonly iterations: readonly RepairIterationRecord[];
  readonly tradeOffReport: TradeOffReport | null;
  readonly finalRecord: RepairSessionRecord | null;
  readonly errorMessage: string | null;
}
