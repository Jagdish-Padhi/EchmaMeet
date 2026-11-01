import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { authenticateToken, type UserSessionProfile } from './auth';
import type { SqlDatabase } from './db';

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
    }
  | { readonly type: 'canvas_replay_request'; readonly afterSequence: number }
  | { readonly type: 'canvas_snapshot'; readonly topology: unknown }
  | { readonly type: 'chat_message'; readonly message: unknown }
  | { readonly type: 'webrtc_offer'; readonly fromUserId: string; readonly toUserId: string; readonly offer?: unknown; readonly sdp?: unknown }
  | { readonly type: 'webrtc_answer'; readonly fromUserId: string; readonly toUserId: string; readonly answer?: unknown; readonly sdp?: unknown }
  | { readonly type: 'webrtc_ice_candidate'; readonly fromUserId: string; readonly toUserId: string; readonly candidate: unknown }
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
}

interface RoomState {
  readonly roomId: string;
  readonly clients: Set<ClientSession>;
  sequence: number;
  readonly operations: CanvasOperation[];
  readonly processedOpIds: Set<string>;
  latestSnapshot?: unknown;
}

export interface CollaborationBridgeOptions {
  readonly db?: SqlDatabase;
  readonly jwtSecret?: string;
  readonly validateRoomAccess?: (
    userId: string,
    roomId: string,
  ) => boolean | Promise<boolean>;
  readonly maxPayloadBytes?: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 65_536; // 64 KB

/**
 * Real-Time Distributed Collaboration & Multi-Cursor WebSocket Bridge with Room Isolation.
 * Synchronizes reviewer cursors, active selections, canvas operations, chat, and WebRTC media signaling
 * strictly isolated per room, with authenticated upgrade and participant identity derivation.
 */
export function attachCollaborationWebSocketBridge(
  httpServer: Server,
  options?: CollaborationBridgeOptions,
): WebSocketServer {
  const maxPayload = options?.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const wss = new WebSocketServer({ noServer: true, maxPayload });
  const rooms = new Map<string, RoomState>();
  const socketSessionMap = new Map<WebSocket, ClientSession>();

  const getOrCreateRoom = (roomId: string): RoomState => {
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        clients: new Set<ClientSession>(),
        sequence: 0,
        operations: [],
        processedOpIds: new Set<string>(),
      };
      rooms.set(roomId, room);
    }
    return room;
  };

  httpServer.on('upgrade', async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/ws/collaboration') {
      return;
    }

    // 1. Authenticate WebSocket upgrade
    const authHeader = request.headers.authorization;
    let token = url.searchParams.get('token');
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
    if (!token && request.headers.cookie) {
      const match = /(?:^|;\s*)session_token=([^;]+)/.exec(request.headers.cookie);
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
      }
    }

    const authenticatedUser = authenticateToken(token, options?.db, options?.jwtSecret);
    if (!authenticatedUser) {
      socket.write(
        'HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUnauthorized\n',
      );
      socket.destroy();
      return;
    }

    // 2. Validate room identifier
    const rawRoom = url.searchParams.get('room') ?? url.searchParams.get('roomId');
    const roomId = rawRoom?.trim();
    if (!roomId || roomId.length === 0 || roomId.length > 64 || !/^[#a-zA-Z0-9_\-\.]+$/.test(roomId)) {
      socket.write(
        'HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nInvalid room identifier\n',
      );
      socket.destroy();
      return;
    }

    // 3. Validate room membership & permissions
    if (options?.validateRoomAccess) {
      try {
        const hasAccess = options.validateRoomAccess(authenticatedUser.userId, roomId);
        const allowed = typeof hasAccess === 'boolean' ? hasAccess : await hasAccess;
        if (!allowed) {
          socket.write(
            'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nForbidden\n',
          );
          socket.destroy();
          return;
        }
      } catch {
        socket.write(
          'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nForbidden\n',
        );
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as unknown as { authenticatedUser: UserSessionProfile }).authenticatedUser =
        authenticatedUser;
      wss.emit('connection', ws, request);
    });
  });

  const broadcastToRoom = (roomId: string, sender: WebSocket, message: CollaborationMessage) => {
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
        break;
      }
    }
  };

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const rawRoom = url.searchParams.get('room') ?? url.searchParams.get('roomId') ?? 'default';
    const roomId = rawRoom.trim();

    const authenticatedUser = (ws as unknown as { authenticatedUser: UserSessionProfile })
      .authenticatedUser;

    const room = getOrCreateRoom(roomId);

    // Support multi-tab sessions for the same authenticated reviewer seamlessly
    // without prematurely evicting previous active tabs.

    const initialUser: PresenceUser = {
      userId: authenticatedUser.userId,
      name: authenticatedUser.name,
      role: authenticatedUser.role,
      avatar: authenticatedUser.avatar,
      cursor: { x: 0, y: 0 },
      selectedNodeId: null,
    };

    const session: ClientSession = {
      ws,
      roomId,
      authenticatedUser,
      user: initialUser,
      isAlive: true,
    };
    socketSessionMap.set(ws, session);
    room.clients.add(session);

    // Heartbeat listener
    ws.on('pong', () => {
      session.isAlive = true;
    });

    // Send active roster of this room to newcomer
    const activeUsers: PresenceUser[] = [];
    for (const s of room.clients) {
      activeUsers.push(s.user);
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({ type: 'roster', users: activeUsers } satisfies CollaborationMessage),
      );
      // Send canvas sync (sequence, operations log, latest snapshot)
      ws.send(
        JSON.stringify({
          type: 'canvas_sync',
          sequence: room.sequence,
          operations: room.operations,
          snapshot: room.latestSnapshot,
        } satisfies CollaborationMessage),
      );
    }

    ws.on('message', (raw, isBinary) => {
      if (isBinary) {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'invalid_format',
            message: 'Binary frames not supported on collaboration channel',
          } satisfies CollaborationMessage),
        );
        return;
      }

      let text = '';
      if (typeof raw === 'string') {
        text = raw;
      } else if (Buffer.isBuffer(raw)) {
        if (raw.length > maxPayload) {
          ws.close(1009, 'Message exceeds maximum allowed payload size');
          return;
        }
        text = raw.toString('utf8');
      } else if (raw instanceof ArrayBuffer) {
        text = Buffer.from(raw).toString('utf8');
      } else if (Array.isArray(raw)) {
        text = Buffer.concat(raw).toString('utf8');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'malformed_json',
            message: 'Message must be valid JSON',
          } satisfies CollaborationMessage),
        );
        return;
      }

      const validation = incomingMessageSchema.safeParse(parsedJson);
      if (!validation.success) {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'schema_validation_failed',
            message: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          } satisfies CollaborationMessage),
        );
        return;
      }

      const msg = validation.data;

      if (msg.type === 'sync_user') {
        // Enforce participant identity derivation: reject impersonation attempts
        if (msg.user.userId && msg.user.userId !== session.authenticatedUser.userId) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'forbidden_impersonation',
              message: 'Participant impersonation is rejected: userId does not match session',
            } satisfies CollaborationMessage),
          );
          return;
        }

        // Apply state with authenticated identity preserved
        session.user = {
          userId: session.authenticatedUser.userId,
          name: msg.user.name || session.authenticatedUser.name,
          role: msg.user.role || session.authenticatedUser.role,
          avatar: msg.user.avatar || session.authenticatedUser.avatar,
          cursor: msg.user.cursor || session.user.cursor,
          selectedNodeId:
            msg.user.selectedNodeId !== undefined
              ? msg.user.selectedNodeId
              : session.user.selectedNodeId,
          isSpeaking: msg.user.isSpeaking ?? session.user.isSpeaking,
        };

        broadcastToRoom(roomId, ws, {
          type: 'sync_user',
          user: session.user,
        });
      } else if (msg.type === 'canvas_op') {
        const currentRoom = getOrCreateRoom(roomId);

        // Duplicate operation prevention
        if (currentRoom.processedOpIds.has(msg.opId)) {
          ws.send(
            JSON.stringify({
              type: 'canvas_ack',
              opId: msg.opId,
              sequence: currentRoom.sequence,
            } satisfies CollaborationMessage),
          );
          return;
        }

        currentRoom.sequence += 1;
        currentRoom.processedOpIds.add(msg.opId);
        if (currentRoom.processedOpIds.size > 5000) {
          const first = currentRoom.processedOpIds.values().next().value;
          if (first) currentRoom.processedOpIds.delete(first);
        }

        const sequencedOp: CanvasOperation = {
          opId: msg.opId,
          op: msg.op,
          payload: msg.payload,
          actorId: session.authenticatedUser.userId,
          roomId,
          sequence: currentRoom.sequence,
          timestamp: Date.now(),
        };

        currentRoom.operations.push(sequencedOp);
        if (currentRoom.operations.length > 500) {
          currentRoom.operations.shift();
        }

        // Acknowledge operation to actor
        ws.send(
          JSON.stringify({
            type: 'canvas_ack',
            opId: sequencedOp.opId,
            sequence: sequencedOp.sequence,
          } satisfies CollaborationMessage),
        );

        // Broadcast sequenced operation to peers
        broadcastToRoom(roomId, ws, {
          type: 'canvas_op',
          ...sequencedOp,
        });
      } else if (msg.type === 'canvas_replay_request') {
        const currentRoom = getOrCreateRoom(roomId);
        const ops = currentRoom.operations.filter((op) => op.sequence > msg.afterSequence);
        ws.send(
          JSON.stringify({
            type: 'canvas_sync',
            sequence: currentRoom.sequence,
            operations: ops,
            snapshot: currentRoom.latestSnapshot,
          } satisfies CollaborationMessage),
        );
      } else if (msg.type === 'canvas_snapshot') {
        const currentRoom = getOrCreateRoom(roomId);
        currentRoom.latestSnapshot = msg.topology;
        broadcastToRoom(roomId, ws, msg as CollaborationMessage);
      } else if (msg.type === 'node_moved' || msg.type === 'edge_selected') {
        broadcastToRoom(roomId, ws, msg as CollaborationMessage);
      } else if (msg.type === 'chat_message') {
        // Anti-spoofing enforcement: enforce authenticated sender metadata
        const messagePayload =
          typeof msg.message === 'object' && msg.message !== null
            ? {
                ...(msg.message as Record<string, unknown>),
                senderId: session.authenticatedUser.userId,
                senderName: session.authenticatedUser.name,
                senderRole: session.authenticatedUser.role,
                senderAvatar: session.authenticatedUser.avatar,
                timestamp: Date.now(),
              }
            : {
                text: String(msg.message),
                senderId: session.authenticatedUser.userId,
                senderName: session.authenticatedUser.name,
                senderRole: session.authenticatedUser.role,
                senderAvatar: session.authenticatedUser.avatar,
                timestamp: Date.now(),
              };
        broadcastToRoom(roomId, ws, {
          type: 'chat_message',
          message: messagePayload,
        });
      } else if (
        msg.type === 'webrtc_offer' ||
        msg.type === 'webrtc_answer' ||
        msg.type === 'webrtc_ice_candidate'
      ) {
        // Direct peer-to-peer signaling inside this room with forced verified fromUserId
        const signalingMsg: CollaborationMessage = {
          ...msg,
          fromUserId: session.authenticatedUser.userId,
        };
        sendDirectToUser(roomId, msg.toUserId, signalingMsg);
      }
    });

    ws.on('close', () => {
      const current = socketSessionMap.get(ws);
      if (current) {
        broadcastToRoom(current.roomId, ws, {
          type: 'user_left',
          userId: current.authenticatedUser.userId,
        });
        const currentRoom = rooms.get(current.roomId);
        if (currentRoom) {
          currentRoom.clients.delete(current);
          if (currentRoom.clients.size === 0) {
            rooms.delete(current.roomId);
          }
        }
        socketSessionMap.delete(ws);
      }
    });
  });

  // Keep-alive heartbeat interval to clean up stale connections
  const heartbeatInterval = setInterval(() => {
    for (const [roomId, room] of rooms) {
      for (const session of room.clients) {
        if (!session.isAlive) {
          // Broadcast user_left before terminating so peers are informed immediately
          broadcastToRoom(roomId, session.ws, {
            type: 'user_left',
            userId: session.authenticatedUser.userId,
          });
          session.ws.terminate();
          room.clients.delete(session);
          socketSessionMap.delete(session.ws);
          if (room.clients.size === 0) {
            rooms.delete(roomId);
          }
          continue;
        }
        session.isAlive = false;
        if (session.ws.readyState === session.ws.OPEN) {
          session.ws.ping();
        }
      }
    }
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
