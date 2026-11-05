import { describe, expect, it } from 'vitest';
import { IN_MEMORY, openDatabase } from '../db';
import { runMigrations } from '../migrations';
import { moduleMigrations } from '../../module-migrations';
import { RoomRegistry } from '../rooms';
import { systemClock } from '../system-clock';

function registry() {
  const db = openDatabase(IN_MEMORY);
  runMigrations(db, moduleMigrations, systemClock);
  const rooms = new RoomRegistry(db);
  rooms.admit('alice', 'room-a');
  return { rooms, db };
}

const op = (sequence: number) => ({
  opId: `op-${String(sequence)}`,
  op: 'create_node',
  payload: { n: sequence },
  actorId: 'alice',
  roomId: 'room-a',
  sequence,
  timestamp: sequence,
});

describe('canvas recovery: operations are never trimmed before a snapshot covers them', () => {
  it('keeps every operation past the replay window while no snapshot exists', () => {
    const { rooms } = registry();
    for (let i = 1; i <= 650; i += 1) rooms.appendOperation(op(i));
    const loaded = rooms.loadCanvas('room-a');
    // The full history is still the only record of these edits: nothing may be dropped.
    expect(loaded.operations).toHaveLength(650);
    expect(loaded.operations[0]?.sequence).toBe(1);
    expect(loaded.snapshot).toBeUndefined();
  });

  it('trims only what is both outside the window and covered by the snapshot', () => {
    const { rooms } = registry();
    for (let i = 1; i <= 650; i += 1) rooms.appendOperation(op(i));
    rooms.saveSnapshot('room-a', { nodes: ['state@600'] }, 600);
    rooms.appendOperation(op(651));
    const loaded = rooms.loadCanvas('room-a');
    // Window trims below 651-500=151; snapshot covers up to 600, so trim up to 151.
    expect(loaded.operations[0]?.sequence).toBe(152);
    expect(loaded.snapshotSequence).toBe(600);
    expect(loaded.snapshot).toEqual({ nodes: ['state@600'] });
    // Everything after the snapshot is intact, so snapshot + replay reconstructs the canvas.
    const afterSnapshot = loaded.operations.filter((o) => o.sequence > loaded.snapshotSequence);
    expect(afterSnapshot.map((o) => o.sequence)).toEqual(
      Array.from({ length: 51 }, (_, i) => 601 + i),
    );
  });

  it('applies a hard ceiling so a room that never snapshots cannot grow without bound', () => {
    const { rooms } = registry();
    for (let i = 1; i <= 5_200; i += 1) rooms.appendOperation(op(i));
    const loaded = rooms.loadCanvas('room-a');
    expect(loaded.operations.length).toBeLessThanOrEqual(5_000);
    expect(loaded.operations.at(-1)?.sequence).toBe(5_200);
  });
});
