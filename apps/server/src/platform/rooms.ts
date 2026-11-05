import type { SqlDatabase } from './db';
import type { ModuleMigrations } from './migrations';

/**
 * Room registry: the authority on who may enter a review room and the durable home of each
 * room's canvas state.
 *
 * Access model (capability + ownership):
 *  - A room identifier is an unguessable capability, like a meeting code. Knowing it is
 *    necessary but, once the room exists, an authenticated user is only admitted while the room
 *    is open or when they are already a member.
 *  - The first authenticated user to enter an unknown room becomes its owner.
 *  - The owner can lock a room (no new members) and remove members.
 *  - REST endpoints that expose room data (transcripts, ICE credentials, media tokens) require
 *    membership; a bare login is not enough.
 */

export const ROOM_ID_PATTERN = /^[#a-zA-Z0-9_\-.]{1,64}$/;
export const MAX_ROOM_PARTICIPANTS = 8;
/** Operations kept in the live replay window. */
export const MAX_PERSISTED_OPERATIONS = 500;
/**
 * Hard ceiling on retained operations. Operations newer than the latest snapshot are never
 * trimmed (they are the only record of those edits) until this ceiling forces it.
 */
export const HARD_MAX_PERSISTED_OPERATIONS = 5_000;

export const roomsMigrations: ModuleMigrations = {
  module: 'rooms',
  migrations: [
    {
      version: 1,
      name: 'create_rooms_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          locked INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_members (
          room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          joined_at TEXT NOT NULL,
          PRIMARY KEY (room_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS room_canvas (
          room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL DEFAULT 0,
          snapshot TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_operations (
          room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          op_id TEXT NOT NULL,
          op TEXT NOT NULL,
          payload TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          PRIMARY KEY (room_id, sequence)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_room_operations_op_id
          ON room_operations(room_id, op_id);
      `,
    },
    {
      version: 2,
      name: 'create_room_transcripts',
      sql: `
        CREATE TABLE IF NOT EXISTS room_transcripts (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          speaker_id TEXT NOT NULL,
          speaker_name TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          model_id TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_room_transcripts_room ON room_transcripts(room_id, timestamp_ms);
      `,
    },
    {
      version: 3,
      name: 'add_snapshot_sequence',
      sql: `ALTER TABLE room_canvas ADD COLUMN snapshot_sequence INTEGER NOT NULL DEFAULT 0;`,
    },
  ],
};

export interface StoredTranscript {
  readonly id: string;
  readonly roomId: string;
  readonly speakerId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly timestampMs: number;
  readonly durationMs: number;
  readonly modelId: string;
}

export type AdmitResult =
  | { readonly ok: true; readonly role: 'owner' | 'member'; readonly created: boolean }
  | { readonly ok: false; readonly reason: 'invalid_room' | 'locked' };

export interface PersistedOperation {
  readonly opId: string;
  readonly op: string;
  readonly payload: unknown;
  readonly actorId: string;
  readonly roomId: string;
  readonly sequence: number;
  readonly timestamp: number;
}

export interface PersistedCanvas {
  readonly sequence: number;
  readonly snapshot: unknown;
  /** Sequence number the snapshot already includes; replay only operations after it. */
  readonly snapshotSequence: number;
  readonly operations: readonly PersistedOperation[];
}

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export class RoomRegistry {
  constructor(
    private readonly db: SqlDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  static isValidRoomId(roomId: string): boolean {
    return ROOM_ID_PATTERN.test(roomId);
  }

  /** Admits a user to a room, creating the room (and making them owner) if it is new. */
  admit(userId: string, roomId: string): AdmitResult {
    if (!userId || !RoomRegistry.isValidRoomId(roomId)) {
      return { ok: false, reason: 'invalid_room' };
    }
    const nowIso = this.now().toISOString();
    return this.db.transaction<AdmitResult>(() => {
      const room = this.db.get('SELECT owner_id, locked FROM rooms WHERE id = ?', [roomId]);
      if (!room) {
        this.db.run('INSERT INTO rooms (id, owner_id, locked, created_at) VALUES (?, ?, 0, ?)', [
          roomId,
          userId,
          nowIso,
        ]);
        this.db.run(
          'INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
          [roomId, userId, 'owner', nowIso],
        );
        this.db.run(
          'INSERT INTO room_canvas (room_id, sequence, snapshot, updated_at) VALUES (?, 0, NULL, ?)',
          [roomId, nowIso],
        );
        return { ok: true, role: 'owner', created: true };
      }

      const member = this.db.get(
        'SELECT role FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId],
      );
      if (member) {
        return { ok: true, role: member['role'] === 'owner' ? 'owner' : 'member', created: false };
      }
      if (Number(room['locked']) === 1) {
        return { ok: false, reason: 'locked' };
      }
      this.db.run(
        'INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [roomId, userId, 'member', nowIso],
      );
      return { ok: true, role: 'member', created: false };
    });
  }

  isMember(userId: string, roomId: string): boolean {
    if (!userId || !RoomRegistry.isValidRoomId(roomId)) return false;
    return (
      this.db.get('SELECT 1 AS present FROM room_members WHERE room_id = ? AND user_id = ?', [
        roomId,
        userId,
      ]) !== undefined
    );
  }

  isOwner(userId: string, roomId: string): boolean {
    const row = this.db.get('SELECT owner_id FROM rooms WHERE id = ?', [roomId]);
    return row !== undefined && row['owner_id'] === userId;
  }

  /** Owner-only. Returns false when the caller is not the owner. */
  setLocked(userId: string, roomId: string, locked: boolean): boolean {
    if (!this.isOwner(userId, roomId)) return false;
    this.db.run('UPDATE rooms SET locked = ? WHERE id = ?', [locked ? 1 : 0, roomId]);
    return true;
  }

  /** Owner-only. The owner cannot remove themselves. */
  removeMember(ownerId: string, roomId: string, targetUserId: string): boolean {
    if (!this.isOwner(ownerId, roomId) || ownerId === targetUserId) return false;
    return (
      this.db.run('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [
        roomId,
        targetUserId,
      ]).changes > 0
    );
  }

  loadCanvas(roomId: string): PersistedCanvas {
    const canvas = this.db.get(
      'SELECT sequence, snapshot, snapshot_sequence FROM room_canvas WHERE room_id = ?',
      [roomId],
    );
    const rows = this.db.all(
      `SELECT sequence, op_id, op, payload, actor_id, timestamp_ms
         FROM room_operations WHERE room_id = ? ORDER BY sequence ASC`,
      [roomId],
    );
    return {
      sequence: canvas ? Number(canvas['sequence']) : 0,
      snapshot: canvas ? parseJson(canvas['snapshot']) : undefined,
      snapshotSequence: canvas ? Number(canvas['snapshot_sequence'] ?? 0) : 0,
      operations: rows.map((row) => ({
        opId: String(row['op_id']),
        op: String(row['op']),
        payload: parseJson(row['payload']),
        actorId: String(row['actor_id']),
        roomId,
        sequence: Number(row['sequence']),
        timestamp: Number(row['timestamp_ms']),
      })),
    };
  }

  /** Persists one sequenced operation and trims the log to the most recent entries. */
  appendOperation(operation: PersistedOperation): void {
    this.db.transaction(() => {
      this.db.run(
        `INSERT OR IGNORE INTO room_operations
           (room_id, sequence, op_id, op, payload, actor_id, timestamp_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          operation.roomId,
          operation.sequence,
          operation.opId,
          operation.op,
          JSON.stringify(operation.payload ?? null),
          operation.actorId,
          operation.timestamp,
        ],
      );
      this.db.run('UPDATE room_canvas SET sequence = ?, updated_at = ? WHERE room_id = ?', [
        operation.sequence,
        this.now().toISOString(),
        operation.roomId,
      ]);
      // Trim only what is both outside the replay window AND already captured by a snapshot,
      // unless the hard ceiling forces it. Un-snapshotted history is the only record of those edits.
      const snap = this.db.get('SELECT snapshot_sequence FROM room_canvas WHERE room_id = ?', [
        operation.roomId,
      ]);
      const snapshotSequence = Number(snap?.['snapshot_sequence'] ?? 0);
      const trimBefore = Math.max(
        Math.min(operation.sequence - MAX_PERSISTED_OPERATIONS, snapshotSequence),
        operation.sequence - HARD_MAX_PERSISTED_OPERATIONS,
      );
      this.db.run('DELETE FROM room_operations WHERE room_id = ? AND sequence <= ?', [
        operation.roomId,
        trimBefore,
      ]);
    });
  }

  /** Idempotent by chunk id, so client retries never duplicate a segment. */
  addTranscript(segment: StoredTranscript): boolean {
    return (
      this.db.run(
        `INSERT OR IGNORE INTO room_transcripts
           (id, room_id, speaker_id, speaker_name, text, timestamp_ms, duration_ms, model_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          segment.id,
          segment.roomId,
          segment.speakerId,
          segment.speakerName,
          segment.text,
          segment.timestampMs,
          segment.durationMs,
          segment.modelId,
        ],
      ).changes > 0
    );
  }

  listTranscripts(roomId: string, limit = 500): StoredTranscript[] {
    return this.db
      .all(
        `SELECT id, speaker_id, speaker_name, text, timestamp_ms, duration_ms, model_id
           FROM room_transcripts WHERE room_id = ? ORDER BY timestamp_ms ASC LIMIT ?`,
        [roomId, limit],
      )
      .map((row) => ({
        id: String(row['id']),
        roomId,
        speakerId: String(row['speaker_id']),
        speakerName: String(row['speaker_name']),
        text: String(row['text']),
        timestampMs: Number(row['timestamp_ms']),
        durationMs: Number(row['duration_ms']),
        modelId: String(row['model_id']),
      }));
  }

  /** `atSequence` is the last operation the snapshot's author had applied when taking it. */
  saveSnapshot(roomId: string, snapshot: unknown, atSequence: number): void {
    this.db.run(
      'UPDATE room_canvas SET snapshot = ?, snapshot_sequence = ?, updated_at = ? WHERE room_id = ?',
      [JSON.stringify(snapshot ?? null), Math.max(0, atSequence), this.now().toISOString(), roomId],
    );
  }
}
