import type { Server } from 'node:http';
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
  | { readonly type: 'roster'; readonly users: readonly PresenceUser[] };

interface ClientSession {
  readonly ws: WebSocket;
  user?: PresenceUser;
}

/**
 * Real-Time Distributed Collaboration & Multi-Cursor WebSocket Bridge.
 * Synchronizes reviewer cursors, active selections, and canvas actions across all active browser tabs.
 */
export function attachCollaborationWebSocketBridge(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, ClientSession>();

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/ws/collaboration') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const broadcast = (sender: WebSocket, message: CollaborationMessage) => {
    const payload = JSON.stringify(message);
    for (const [ws] of clients) {
      if (ws !== sender && ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  };

  wss.on('connection', (ws: WebSocket) => {
    clients.set(ws, { ws });

    // Send active roster to newcomer
    const activeUsers: PresenceUser[] = [];
    for (const session of clients.values()) {
      if (session.user) {
        activeUsers.push(session.user);
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
          const session = clients.get(ws);
          if (session) {
            session.user = msg.user;
          }
          broadcast(ws, msg);
        } else if (msg.type === 'node_moved' || msg.type === 'edge_selected') {
          broadcast(ws, msg);
        }
      } catch {
        // Discard malformed frames
      }
    });

    ws.on('close', () => {
      const session = clients.get(ws);
      if (session?.user) {
        broadcast(ws, { type: 'user_left', userId: session.user.userId });
      }
      clients.delete(ws);
    });
  });

  return wss;
}
