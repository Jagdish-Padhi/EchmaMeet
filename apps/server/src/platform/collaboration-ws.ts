import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

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
  readonly selectedNodeId?: string | null;
  readonly isSpeaking?: boolean;
}

export type CollaborationMessage =
  | { readonly type: 'sync_user'; readonly user: PresenceUser }
  | { readonly type: 'user_left'; readonly userId: string }
  | { readonly type: 'node_moved'; readonly nodeId: string; readonly x: number; readonly y: number }
  | { readonly type: 'edge_selected'; readonly edgeId: string | null }
  | { readonly type: 'canvas_op'; readonly op: string; readonly payload: unknown }
  | { readonly type: 'canvas_snapshot'; readonly topology: unknown }
  | { readonly type: 'chat_message'; readonly message: unknown }
  | { readonly type: 'webrtc_offer'; readonly fromUserId: string; readonly toUserId: string; readonly sdp: unknown }
  | { readonly type: 'webrtc_answer'; readonly fromUserId: string; readonly toUserId: string; readonly sdp: unknown }
  | { readonly type: 'webrtc_ice_candidate'; readonly fromUserId: string; readonly toUserId: string; readonly candidate: unknown }
  | { readonly type: 'roster'; readonly users: readonly PresenceUser[] };

interface ClientSession {
  readonly ws: WebSocket;
  readonly roomId: string;
  user?: PresenceUser;
}

/**
 * Real-Time Distributed Collaboration & Multi-Cursor WebSocket Bridge with Room Isolation.
 * Synchronizes reviewer cursors, active selections, canvas operations, chat, and WebRTC media signaling
 * strictly isolated per room.
 */
export function attachCollaborationWebSocketBridge(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  // Map of roomId -> Set of active client sessions in that room
  const rooms = new Map<string, Set<ClientSession>>();
  const socketSessionMap = new Map<WebSocket, ClientSession>();

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/ws/collaboration') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const broadcastToRoom = (roomId: string, sender: WebSocket, message: CollaborationMessage) => {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;
    const payload = JSON.stringify(message);
    for (const session of roomClients) {
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
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;
    const payload = JSON.stringify(message);
    for (const session of roomClients) {
      if (session.user?.userId === targetUserId && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(payload);
        break;
      }
    }
  };

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const rawRoom = url.searchParams.get('room') ?? url.searchParams.get('roomId') ?? 'default';
    const roomId = rawRoom.trim() || 'default';

    const session: ClientSession = { ws, roomId };
    socketSessionMap.set(ws, session);

    let roomSet = rooms.get(roomId);
    if (!roomSet) {
      roomSet = new Set<ClientSession>();
      rooms.set(roomId, roomSet);
    }
    roomSet.add(session);

    // Send active roster of this room to newcomer
    const activeUsers: PresenceUser[] = [];
    for (const s of roomSet) {
      if (s.user) {
        activeUsers.push(s.user);
      }
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({ type: 'roster', users: activeUsers } satisfies CollaborationMessage),
      );
    }

    ws.on('message', (raw) => {
      try {
        let text = '';
        if (typeof raw === 'string') {
          text = raw;
        } else if (Buffer.isBuffer(raw)) {
          text = raw.toString('utf8');
        } else if (raw instanceof ArrayBuffer) {
          text = Buffer.from(raw).toString('utf8');
        } else if (Array.isArray(raw)) {
          text = Buffer.concat(raw).toString('utf8');
        }
        const msg = JSON.parse(text) as CollaborationMessage;

        if (msg.type === 'sync_user') {
          session.user = msg.user;
          broadcastToRoom(roomId, ws, msg);
        } else if (
          msg.type === 'node_moved' ||
          msg.type === 'edge_selected' ||
          msg.type === 'canvas_op' ||
          msg.type === 'canvas_snapshot' ||
          msg.type === 'chat_message'
        ) {
          broadcastToRoom(roomId, ws, msg);
        } else if (
          msg.type === 'webrtc_offer' ||
          msg.type === 'webrtc_answer' ||
          msg.type === 'webrtc_ice_candidate'
        ) {
          // Direct peer-to-peer signaling inside this room
          sendDirectToUser(roomId, msg.toUserId, msg);
        }
      } catch {
        // Discard malformed frames safely
      }
    });

    ws.on('close', () => {
      const current = socketSessionMap.get(ws);
      if (current) {
        if (current.user) {
          broadcastToRoom(current.roomId, ws, { type: 'user_left', userId: current.user.userId });
        }
        const set = rooms.get(current.roomId);
        if (set) {
          set.delete(current);
          if (set.size === 0) {
            rooms.delete(current.roomId);
          }
        }
        socketSessionMap.delete(ws);
      }
    });
  });

  return wss;
}
