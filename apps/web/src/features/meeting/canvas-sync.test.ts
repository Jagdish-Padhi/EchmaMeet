import { describe, expect, it } from 'vitest';
import { planCanvasSync } from './canvas-sync';

const ops = (...seqs: number[]) => seqs.map((sequence) => ({ sequence }));

describe('planCanvasSync', () => {
  it('replays full history for a fresh joiner without touching the snapshot', () => {
    const plan = planCanvasSync({
      lastSequence: 0,
      serverSequence: 3,
      snapshotSequence: 2,
      hasSnapshot: true,
      operations: ops(1, 2, 3),
    });
    expect(plan.useSnapshot).toBe(false);
    expect(plan.operations.map((o) => o.sequence)).toEqual([1, 2, 3]);
    expect(plan.nextSequence).toBe(3);
  });

  it('applies only the missed tail when the history is contiguous (reconnect)', () => {
    const plan = planCanvasSync({
      lastSequence: 5,
      serverSequence: 8,
      snapshotSequence: 0,
      hasSnapshot: false,
      operations: ops(1, 2, 3, 4, 5, 6, 7, 8),
    });
    expect(plan.useSnapshot).toBe(false);
    expect(plan.operations.map((o) => o.sequence)).toEqual([6, 7, 8]);
  });

  it('recovers from the snapshot when trimmed history leaves a hole', () => {
    // Operations 1..150 were trimmed after a snapshot at 600 covered them.
    const plan = planCanvasSync({
      lastSequence: 0,
      serverSequence: 651,
      snapshotSequence: 600,
      hasSnapshot: true,
      operations: ops(152, 153, 600, 601, 650, 651),
    });
    expect(plan.useSnapshot).toBe(true);
    // Operations covered by the snapshot are not replayed on top of it.
    expect(plan.operations.map((o) => o.sequence)).toEqual([601, 650, 651]);
    expect(plan.nextSequence).toBe(651);
  });

  it('falls back to replay when a gap exists but no snapshot was ever stored', () => {
    const plan = planCanvasSync({
      lastSequence: 0,
      serverSequence: 10,
      snapshotSequence: 0,
      hasSnapshot: false,
      operations: ops(6, 7, 8, 9, 10),
    });
    expect(plan.useSnapshot).toBe(false);
    expect(plan.operations).toHaveLength(5);
  });

  it('is a no-op when the client is already current', () => {
    const plan = planCanvasSync({
      lastSequence: 9,
      serverSequence: 9,
      snapshotSequence: 4,
      hasSnapshot: true,
      operations: ops(5, 6, 7, 8, 9),
    });
    expect(plan.useSnapshot).toBe(false);
    expect(plan.operations).toHaveLength(0);
    expect(plan.nextSequence).toBe(9);
  });
});
