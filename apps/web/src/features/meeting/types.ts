import type { EdgeId, EdgePolicy, NodeId } from '@chaosboard/contracts';

export interface SreHazardPatch extends Partial<EdgePolicy> {
  readonly mode?: 'sync_call' | 'async_enqueue';
  readonly queue?: { mode: 'bounded' | 'unbounded'; maxDepth?: number };
  readonly concurrency?: { maxWorkers?: number };
}

export interface SreHazard {
  readonly id: string;
  readonly targetEdgeId?: EdgeId;
  readonly targetNodeId?: NodeId;
  readonly title: string;
  readonly severity: 'critical' | 'high' | 'warning';
  readonly risk: string;
  readonly recommendation: string;
  readonly patch?: SreHazardPatch;
}

export interface MeetingParticipant {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  readonly isSpeaking?: boolean;
  readonly isAi?: boolean;
}
