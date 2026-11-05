export interface SyncedOperation {
  readonly sequence?: number | undefined;
}

export interface CanvasSyncPlan<T extends SyncedOperation> {
  /** Recover from the room snapshot before replaying operations. */
  readonly useSnapshot: boolean;
  /** Operations to apply, in order, after the snapshot (if any). */
  readonly operations: readonly T[];
  /** The highest sequence the client has applied once the plan is executed. */
  readonly nextSequence: number;
}

/**
 * Decides how a client catches up with a room.
 *
 * Replaying operations is exact only when the history is contiguous with what the client already
 * has. When the oldest available operation is newer than the next one needed, a hole exists
 * (older operations were trimmed after a snapshot covered them), and replay alone would build the
 * wrong canvas, so the snapshot is applied first and only operations after it are replayed.
 */
export function planCanvasSync<T extends SyncedOperation>(input: {
  readonly lastSequence: number;
  readonly serverSequence: number;
  readonly snapshotSequence: number;
  readonly hasSnapshot: boolean;
  readonly operations: readonly T[];
}): CanvasSyncPlan<T> {
  const { lastSequence, serverSequence, snapshotSequence, hasSnapshot, operations } = input;
  const sequences = operations
    .map((op) => op.sequence)
    .filter((s): s is number => typeof s === 'number');
  const firstAvailable = sequences.length > 0 ? Math.min(...sequences) : Number.POSITIVE_INFINITY;
  const hasGap =
    serverSequence > lastSequence && (sequences.length === 0 || firstAvailable > lastSequence + 1);
  const useSnapshot = hasGap && hasSnapshot;

  let applied = useSnapshot ? Math.max(lastSequence, snapshotSequence) : lastSequence;
  const toApply: T[] = [];
  for (const op of operations) {
    const sequence = typeof op.sequence === 'number' ? op.sequence : 0;
    if (sequence > applied) {
      applied = sequence;
      toApply.push(op);
    }
  }
  return { useSnapshot, operations: toApply, nextSequence: Math.max(applied, serverSequence) };
}
