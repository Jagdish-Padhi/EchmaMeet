import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { authenticateToken, type UserSessionProfile } from './auth';
import type { SqlDatabase } from './db';
import {
  RoomRegistry,
  MAX_ROOM_PARTICIPANTS,
  MAX_PERSISTED_OPERATIONS,
  HARD_MAX_PERSISTED_OPERATIONS,
} from './rooms';

export interface PresenceCursor {
  readonly x: number;
  readonly y: number;
}

export interface PresenceUser {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly cursor: PresenceCursor;
  readonly selectedNodeId?: string | null | undefined;
  readonly isSpeaking?: boolean | undefined;
}

export interface CanvasOperation {
  readonly opId: string;
  readonly op: string;
  readonly payload: unknown;
  readonly actorId: string;
  readonly roomId: string;
  readonly sequence: number;
  readonly timestamp: number;
}

export type CollaborationMessage =
  | { readonly type: 'sync_user'; readonly user: PresenceUser }
  | { readonly type: 'user_left'; readonly userId: string }
  | { readonly type: 'node_moved'; readonly nodeId: string; readonly x: number; readonly y: number }
  | { readonly type: 'edge_selected'; readonly edgeId: string | null }
  | {
      readonly type: 'canvas_op';
      readonly opId: string;
      readonly op: string;
      readonly payload: unknown;
      readonly actorId?: string;
      readonly roomId?: string;
      readonly sequence?: number;
      readonly timestamp?: number;
    }
  | { readonly type: 'canvas_ack'; readonly opId: string; readonly sequence: number }
  | {
      readonly type: 'canvas_sync';
      readonly sequence: number;
      readonly operations: readonly CanvasOperation[];
      readonly snapshot?: unknown;
      readonly snapshotSequence?: number | undefined;
    }
  | { readonly type: 'canvas_replay_request'; readonly afterSequence: number }
  | {
      readonly type: 'canvas_snapshot';
      readonly topology: unknown;
      readonly atSequence?: number | undefined;
    }
  | { readonly type: 'chat_message'; readonly message: unknown }
  | {
      readonly type: 'webrtc_offer';
      readonly fromUserId: string;
      readonly toUserId: string;
      readonly offer?: unknown;
      readonly sdp?: unknown;
    }
  | {
      readonly type: 'webrtc_answer';
      readonly fromUserId: string;
      readonly toUserId: string;
      readonly answer?: unknown;
      readonly sdp?: unknown;
    }
  | {
      readonly type: 'webrtc_ice_candidate';
      readonly fromUserId: string;
      readonly toUserId: string;
      readonly candidate: unknown;
    }
  | { readonly type: 'roster'; readonly users: readonly PresenceUser[] }
  | { readonly type: 'error'; readonly code: string; readonly message: string };

const cursorSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const presenceUserPartialSchema = z.object({
  userId: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  avatar: z.string().optional(),
  cursor: cursorSchema.optional(),
  selectedNodeId: z.string().nullable().optional(),
  isSpeaking: z.boolean().optional(),
});

const incomingMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sync_user'),
    user: presenceUserPartialSchema,
  }),
  z.object({
    type: z.literal('user_left'),
    userId: z.string().min(1),
  }),
  z.object({
    type: z.literal('node_moved'),
    nodeId: z.string().min(1),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal('edge_selected'),
    edgeId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('canvas_op'),
    opId: z.string().min(1),
    op: z.string().min(1),
    payload: z.unknown(),
    actorId: z.string().optional(),
    roomId: z.string().optional(),
    sequence: z.number().optional(),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.literal('canvas_replay_request'),
    afterSequence: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('canvas_snapshot'),
    topology: z.unknown(),
    /** Last operation sequence the author had applied when taking the snapshot. */
    atSequence: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal('chat_message'),
    message: z.unknown(),
  }),
  z.object({
    type: z.literal('webrtc_offer'),
    fromUserId: z.string().optional(),
    toUserId: z.string().min(1),
    offer: z.unknown().optional(),
    sdp: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('webrtc_answer'),
    fromUserId: z.string().optional(),
    toUserId: z.string().min(1),
    answer: z.unknown().optional(),
    sdp: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('webrtc_ice_candidate'),
    fromUserId: z.string().optional(),
    toUserId: z.string().min(1),
    candidate: z.unknown(),
  }),
]);

interface ClientSession {
  readonly ws: WebSocket;
  readonly roomId: string;
  readonly authenticatedUser: UserSessionProfile;
  user: PresenceUser;
  isAlive: boolean;
  /** Sliding-window abuse limiter state. */
  windowStartMs: number;
  windowCount: number;
}

interface RoomState {
  readonly roomId: string;
  readonly clients: Set<ClientSession>;
  sequence: number;
  readonly operations: CanvasOperation[];
  readonly processedOpIds: Set<string>;
  latestSnapshot?: unknown;
  /** Sequence the latest snapshot already includes. */
  snapshotSequence: number;
}

export interface CollaborationBridgeOptions {
  readonly db?: SqlDatabase;
  readonly jwtSecret?: string;
  /**
   * Durable room registry. When present it is the authority on admission and the store for
   * canvas operations and snapshots, so a room survives every participant disconnecting and
   * a server restart.
   */
  readonly rooms?: RoomRegistry;
  /** Additional admission policy, evaluated after (or instead of) the registry. */
  readonly validateRoomAccess?: (userId: string, roomId: string) => boolean | Promise<boolean>;
  readonly maxPayloadBytes?: number;
  readonly maxParticipantsPerRoom?: number;
  /** Messages allowed per client per window before the socket is closed with 1008. */
  readonly rateLimit?: { readonly maxMessages: number; readonly windowMs: number };
  readonly heartbeatIntervalMs?: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 65_536; // 64 KB
const DEFAULT_RATE_LIMIT = { maxMessages: 400, windowMs: 5_000 } as const;
const MAX_PROCESSED_OP_IDS = 5_000;
const OP_NAME_PATTERN = /^[a-zA-Z0-9_.:-]{1,64}$/;
const MAX_OP_ID_LENGTH = 128;

function rejectUpgrade(socket: Duplex, status: number, text: string): void {
  socket.write(
    `HTTP/1.1 ${String(status)} ${text}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n${text}\n`,
  );
  socket.destroy();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Real-time collaboration bridge: presence, canvas operation sequencing, chat and WebRTC
 * signaling, isolated per room.
 *
 * Guarantees:
 *  - The upgrade is authenticated and the user is admitted by the room registry.
 *  - Identity on every relayed message (presence, chat, signaling) is the authenticated
 *    identity, never a client-supplied one.
 *  - Operations are sequenced, de-duplicated and persisted; late joiners and reconnecting
 *    clients receive the operations they missed.
 *  - A room's canvas snapshot may only be replaced by a room member.
 *  - Every disconnect path (close, heartbeat timeout, eviction) funnels through one cleanup
 *    routine, so peers always receive `user_left` and empty rooms are released.
 */
export function attachCollaborationWebSocketBridge(
  httpServer: Server,
  options?: CollaborationBridgeOptions,
): WebSocketServer {
  const maxPayload = options?.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const maxParticipants = options?.maxParticipantsPerRoom ?? MAX_ROOM_PARTICIPANTS;
  const rateLimit = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
  const registry = options?.rooms;
  const wss = new WebSocketServer({ noServer: true, maxPayload });
  const rooms = new Map<string, RoomState>();
  const socketSessionMap = new Map<WebSocket, ClientSession>();

  const getOrCreateRoom = (roomId: string): RoomState => {
    let room = rooms.get(roomId);
    if (!room) {
      const persisted = registry?.loadCanvas(roomId);
      room = {
        roomId,
        clients: new Set<ClientSession>(),
        sequence: persisted?.sequence ?? 0,
        operations: persisted ? [...persisted.operations] : [],
        processedOpIds: new Set<string>(persisted?.operations.map((op) => op.opId) ?? []),
        latestSnapshot: persisted?.snapshot,
        snapshotSequence: persisted?.snapshotSequence ?? 0,
      };
      rooms.set(roomId, room);
    }
    return room;
  };

  const send = (ws: WebSocket, message: CollaborationMessage): void => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const broadcastToRoom = (
    roomId: string,
    sender: WebSocket | null,
    message: CollaborationMessage,
  ) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const session of room.clients) {
      if (session.ws !== sender && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(payload);
      }
    }
  };

  const sendDirectToUser = (
    roomId: string,
    targetUserId: string,
    message: CollaborationMessage,
  ) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const session of room.clients) {
      if (
        session.authenticatedUser.userId === targetUserId &&
        session.ws.readyState === session.ws.OPEN
      ) {
        session.ws.send(payload);
        return;
      }
    }
  };

  /** Single teardown path for every way a session can end. Idempotent. */
  const removeSession = (session: ClientSession, announce: boolean): void => {
    if (!socketSessionMap.delete(session.ws)) return;
    const room = rooms.get(session.roomId);
    if (room) {
      room.clients.delete(session);
      if (announce) {
        broadcastToRoom(session.roomId, session.ws, {
          type: 'user_left',
          userId: session.authenticatedUser.userId,
        });
      }
      if (room.clients.size === 0) {
        rooms.delete(session.roomId);
      }
    }
  };

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/ws/collaboration') {
        return;
      }

      // 1. Authenticate
      const authHeader = request.headers.authorization;
      let token = url.searchParams.get('token');
      if (!token && authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }
      if (!token && request.headers.cookie) {
        const match = /(?:^|;\s*)session_token=([^;]+)/.exec(request.headers.cookie);
        if (match?.[1]) {
          token = decodeURIComponent(match[1]);
        }
      }
      const authenticatedUser = authenticateToken(token, options?.db, options?.jwtSecret);
      if (!authenticatedUser) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      // 2. Validate room identifier
      const roomId = (url.searchParams.get('room') ?? url.searchParams.get('roomId') ?? '').trim();
      if (!RoomRegistry.isValidRoomId(roomId)) {
        rejectUpgrade(socket, 400, 'Invalid room identifier');
        return;
      }

      // 3. Admission: durable registry first, then any extra policy
      try {
        if (registry) {
          const admitted = registry.admit(authenticatedUser.userId, roomId);
          if (!admitted.ok) {
            rejectUpgrade(socket, 403, 'Forbidden');
            return;
          }
        }
        if (options?.validateRoomAccess) {
          const allowed = await options.validateRoomAccess(authenticatedUser.userId, roomId);
          if (!allowed) {
            rejectUpgrade(socket, 403, 'Forbidden');
            return;
          }
        }
      } catch {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      // 4. Capacity (mesh WebRTC does not scale; reject instead of degrading everyone)
      const existing = rooms.get(roomId);
      if (existing) {
        const alreadyHere = [...existing.clients].some(
          (c) => c.authenticatedUser.userId === authenticatedUser.userId,
        );
        if (!alreadyHere && existing.clients.size >= maxParticipants) {
          rejectUpgrade(socket, 503, 'Room is full');
          return;
        }
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as unknown as { authenticatedUser: UserSessionProfile }).authenticatedUser =
          authenticatedUser;
        wss.emit('connection', ws, request);
      });
    })();
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const roomId = (url.searchParams.get('room') ?? url.searchParams.get('roomId') ?? '').trim();
    const authenticatedUser = (ws as unknown as { authenticatedUser: UserSessionProfile })
      .authenticatedUser;

    const room = getOrCreateRoom(roomId);

    // A user holds one live session per room: a reconnect replaces the stale socket.
    for (const existing of [...room.clients]) {
      if (existing.authenticatedUser.userId === authenticatedUser.userId) {
        removeSession(existing, false);
        try {
          existing.ws.terminate();
        } catch {
          // already closed
        }
      }
    }

    const session: ClientSession = {
      ws,
      roomId,
      authenticatedUser,
      user: {
        userId: authenticatedUser.userId,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        avatar: authenticatedUser.avatar,
        cursor: { x: 0, y: 0 },
        selectedNodeId: null,
      },
      isAlive: true,
      windowStartMs: Date.now(),
      windowCount: 0,
    };
    socketSessionMap.set(ws, session);
    room.clients.add(session);

    ws.on('pong', () => {
      session.isAlive = true;
    });

    send(ws, { type: 'roster', users: [...room.clients].map((s) => s.user) });
    send(ws, {
      type: 'canvas_sync',
      sequence: room.sequence,
      operations: room.operations,
      snapshot: room.latestSnapshot,
      snapshotSequence: room.snapshotSequence,
    });

    ws.on('message', (raw, isBinary) => {
      // Abuse limiter
      const nowMs = Date.now();
      if (nowMs - session.windowStartMs > rateLimit.windowMs) {
        session.windowStartMs = nowMs;
        session.windowCount = 0;
      }
      session.windowCount += 1;
      if (session.windowCount > rateLimit.maxMessages) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      if (isBinary) {
        send(ws, {
          type: 'error',
          code: 'invalid_format',
          message: 'Binary frames not supported on collaboration channel',
        });
        return;
      }

      let text: string;
      if (typeof raw === 'string') {
        text = raw;
      } else if (Buffer.isBuffer(raw)) {
        text = raw.toString('utf8');
      } else if (Array.isArray(raw)) {
        text = Buffer.concat(raw).toString('utf8');
      } else {
        text = Buffer.from(raw).toString('utf8');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        send(ws, { type: 'error', code: 'malformed_json', message: 'Message must be valid JSON' });
        return;
      }

      const validation = incomingMessageSchema.safeParse(parsedJson);
      if (!validation.success) {
        send(ws, {
          type: 'error',
          code: 'schema_validation_failed',
          message: validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
        return;
      }

      const msg = validation.data;
      const self = session.authenticatedUser;

      switch (msg.type) {
        case 'sync_user': {
          if (msg.user.userId && msg.user.userId !== self.userId) {
            send(ws, {
              type: 'error',
              code: 'forbidden_impersonation',
              message: 'Participant impersonation is rejected: userId does not match session',
            });
            return;
          }
          session.user = {
            userId: self.userId,
            name: msg.user.name || self.name,
            role: msg.user.role || self.role,
            avatar: msg.user.avatar || self.avatar,
            cursor: msg.user.cursor || session.user.cursor,
            selectedNodeId:
              msg.user.selectedNodeId !== undefined
                ? msg.user.selectedNodeId
                : session.user.selectedNodeId,
            isSpeaking: msg.user.isSpeaking ?? session.user.isSpeaking,
          };
          broadcastToRoom(roomId, ws, { type: 'sync_user', user: session.user });
          return;
        }

        case 'canvas_op': {
          if (msg.opId.length > MAX_OP_ID_LENGTH || !OP_NAME_PATTERN.test(msg.op)) {
            send(ws, {
              type: 'error',
              code: 'invalid_operation',
              message: 'Operation id or name is malformed',
            });
            return;
          }
          const current = getOrCreateRoom(roomId);
          if (current.processedOpIds.has(msg.opId)) {
            send(ws, { type: 'canvas_ack', opId: msg.opId, sequence: current.sequence });
            return;
          }
          current.sequence += 1;
          current.processedOpIds.add(msg.opId);
          if (current.processedOpIds.size > MAX_PROCESSED_OP_IDS) {
            const oldest = current.processedOpIds.values().next().value;
            if (oldest !== undefined) current.processedOpIds.delete(oldest);
          }
          const sequenced: CanvasOperation = {
            opId: msg.opId,
            op: msg.op,
            payload: msg.payload,
            actorId: self.userId,
            roomId,
            sequence: current.sequence,
            timestamp: Date.now(),
          };
          current.operations.push(sequenced);
          // Same rule as the durable log: only drop operations outside the replay window that a
          // snapshot already covers (or that exceed the hard ceiling).
          while (
            current.operations.length > MAX_PERSISTED_OPERATIONS &&
            ((current.operations[0]?.sequence ?? Infinity) <= current.snapshotSequence ||
              current.operations.length > HARD_MAX_PERSISTED_OPERATIONS)
          ) {
            current.operations.shift();
          }
          try {
            registry?.appendOperation(sequenced);
          } catch (error) {
            // Persistence failure must never be silent: tell the actor the op is not durable.
            send(ws, {
              type: 'error',
              code: 'persistence_failed',
              message: `Operation applied live but could not be persisted: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            });
          }
          send(ws, { type: 'canvas_ack', opId: sequenced.opId, sequence: sequenced.sequence });
          broadcastToRoom(roomId, ws, { type: 'canvas_op', ...sequenced });
          return;
        }

        case 'canvas_replay_request': {
          const current = getOrCreateRoom(roomId);
          send(ws, {
            type: 'canvas_sync',
            sequence: current.sequence,
            operations: current.operations.filter((op) => op.sequence > msg.afterSequence),
            snapshot: current.latestSnapshot,
            snapshotSequence: current.snapshotSequence,
          });
          return;
        }

        case 'canvas_snapshot': {
          if (!isPlainObject(msg.topology)) {
            send(ws, {
              type: 'error',
              code: 'invalid_snapshot',
              message: 'Snapshot must be a topology object',
            });
            return;
          }
          const current = getOrCreateRoom(roomId);
          // A snapshot can only include operations that exist: clamp the claimed sequence.
          const atSequence = Math.min(msg.atSequence ?? current.sequence, current.sequence);
          // Never let an older snapshot overwrite a newer one.
          if (atSequence < current.snapshotSequence) return;
          current.latestSnapshot = msg.topology;
          current.snapshotSequence = atSequence;
          try {
            registry?.saveSnapshot(roomId, msg.topology, atSequence);
          } catch {
            send(ws, {
              type: 'error',
              code: 'persistence_failed',
              message: 'Snapshot applied live but could not be persisted',
            });
          }
          broadcastToRoom(roomId, ws, {
            type: 'canvas_snapshot',
            topology: msg.topology,
            atSequence,
          });
          return;
        }

        case 'node_moved':
        case 'edge_selected': {
          broadcastToRoom(roomId, ws, msg);
          return;
        }

        case 'chat_message': {
          // Stamp the verified sender; a client can never speak as someone else.
          const body = isPlainObject(msg.message) ? msg.message : { text: msg.message };
          broadcastToRoom(roomId, ws, {
            type: 'chat_message',
            message: {
              ...body,
              senderId: self.userId,
              senderName: self.name,
              sentAt: Date.now(),
            },
          });
          return;
        }

        case 'user_left':
          // Server-originated frames: a client has no business sending them.
          return;

        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate': {
          // Signaling is point-to-point inside the room, with the verified sender stamped.
          sendDirectToUser(roomId, msg.toUserId, {
            ...msg,
            fromUserId: self.userId,
          });
          return;
        }
      }
    });

    ws.on('close', () => {
      removeSession(session, true);
    });
    ws.on('error', () => {
      removeSession(session, true);
    });
  });

  // Heartbeat: terminate dead peers through the same cleanup path as a clean close.
  const heartbeatInterval = setInterval(() => {
    for (const session of [...socketSessionMap.values()]) {
      if (!session.isAlive) {
        removeSession(session, true);
        session.ws.terminate();
        continue;
      }
      session.isAlive = false;
      if (session.ws.readyState === session.ws.OPEN) {
        session.ws.ping();
      }
    }
  }, options?.heartbeatIntervalMs ?? 30_000);
  heartbeatInterval.unref();

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
