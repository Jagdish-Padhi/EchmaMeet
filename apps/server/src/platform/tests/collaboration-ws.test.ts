import { createServer } from 'node:http';
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { attachCollaborationWebSocketBridge } from '../collaboration-ws';

describe('Collaboration WebSocket Bridge with Room Isolation', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function startServer(): Promise<{ port: number; url: string; wss: any; server: any }> {
    return new Promise((resolve) => {
      const server = createServer();
      const wss = attachCollaborationWebSocketBridge(server);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        closers.push(
          () =>
            new Promise<void>((res) => {
              for (const client of wss.clients) {
                try {
                  client.terminate();
                } catch {}
              }
              wss.close(() => {
                if ('closeAllConnections' in server) {
                  (server as any).closeAllConnections();
                }
                server.close(() => res());
              });
            }),
        );
        resolve({ port, url: `ws://127.0.0.1:${port}/ws/collaboration`, wss, server });
      });
    });
  }

  function connectClient(url: string, room: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${url}?room=${encodeURIComponent(room)}`);
      closers.unshift(() => {
        try {
          ws.terminate();
        } catch {}
      });
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('isolates messages between different rooms', async () => {
    const { url } = await startServer();

    // Client A and B join room "room-alpha"
    const clientA1 = await connectClient(url, 'room-alpha');
    const clientA2 = await connectClient(url, 'room-alpha');

    // Client B joins room "room-beta"
    const clientB1 = await connectClient(url, 'room-beta');

    const receivedA2: unknown[] = [];
    clientA2.on('message', (raw) => {
      receivedA2.push(JSON.parse(raw.toString()));
    });

    const receivedB1: unknown[] = [];
    clientB1.on('message', (raw) => {
      receivedB1.push(JSON.parse(raw.toString()));
    });

    // Client A1 announces presence in room-alpha
    clientA1.send(
      JSON.stringify({
        type: 'sync_user',
        user: {
          userId: 'user-1',
          name: 'Alice',
          role: 'Staff SRE',
          avatar: 'A',
          cursor: { x: 100, y: 150 },
        },
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    // Client A2 in room-alpha MUST receive Alice's sync_user
    const a2Sync = receivedA2.find(
      (m: any) => m.type === 'sync_user' && m.user?.userId === 'user-1',
    );
    expect(a2Sync).toBeDefined();

    // Client B1 in room-beta MUST NOT receive Alice's sync_user (complete isolation)
    const b1Sync = receivedB1.find(
      (m: any) => m.type === 'sync_user' && m.user?.userId === 'user-1',
    );
    expect(b1Sync).toBeUndefined();
  });

  it('routes canvas operations and WebRTC peer signaling within the room', async () => {
    const { url } = await startServer();

    const client1 = await connectClient(url, 'room-review-1');
    const client2 = await connectClient(url, 'room-review-1');

    // Identify user 2
    client2.send(
      JSON.stringify({
        type: 'sync_user',
        user: {
          userId: 'user-2',
          name: 'Bob',
          role: 'Reviewer',
          avatar: 'B',
          cursor: { x: 0, y: 0 },
        },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    const client2Messages: any[] = [];
    client2.on('message', (raw) => {
      client2Messages.push(JSON.parse(raw.toString()));
    });

    // Client 1 broadcasts a canvas operation
    client1.send(
      JSON.stringify({
        type: 'canvas_op',
        op: 'add_node',
        payload: { id: 'service-auth', label: 'Auth Gateway' },
      }),
    );

    // Client 1 sends direct WebRTC offer to user-2
    client1.send(
      JSON.stringify({
        type: 'webrtc_offer',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        sdp: { type: 'offer', sdp: 'v=0...' },
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    const opMsg = client2Messages.find((m) => m.type === 'canvas_op' && m.op === 'add_node');
    expect(opMsg).toBeDefined();

    const webrtcMsg = client2Messages.find((m) => m.type === 'webrtc_offer');
    expect(webrtcMsg).toBeDefined();
    expect(webrtcMsg.fromUserId).toBe('user-1');
  });
});
