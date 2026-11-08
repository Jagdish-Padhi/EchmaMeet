import { createServer } from 'node:http';
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  attachCollaborationWebSocketBridge,
  type CollaborationBridgeOptions,
} from '../collaboration-ws';
import { signJwt, DEFAULT_JWT_SECRET } from '../auth';

// The server under test has no database, so session-table tokens cannot resolve. Signed JWTs
// are the stateless credential this bridge must accept.
const TEST_JWT = signJwt(
  { userId: 'eng-alex-chen', name: 'Alex Chen', role: 'Staff SRE', avatar: 'AC' },
  DEFAULT_JWT_SECRET,
);

describe('Collaboration WebSocket Bridge with Security & Room Isolation', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function startServer(
    options?: CollaborationBridgeOptions,
  ): Promise<{ port: number; url: string; wss: any; server: any }> {
    return new Promise((resolve) => {
      const server = createServer();
      const wss = attachCollaborationWebSocketBridge(server, options);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        closers.push(
          () =>
            new Promise<void>((res) => {
              for (const client of wss.clients) {
                try {
                  client.terminate();
                } catch {
                  // ignore
                }
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

  function connectClient(
    url: string,
    room: string,
    token: string = TEST_JWT,
    onMessage?: (msg: any) => void,
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const ws = new WebSocket(`${url}?room=${encodeURIComponent(room)}${tokenParam}`);
      if (onMessage) {
        ws.on('message', (raw) => {
          try {
            onMessage(JSON.parse(raw.toString()));
          } catch {
            // ignore
          }
        });
      }
      closers.unshift(() => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      });
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('rejects unauthorized connection with HTTP 401 when token is missing', async () => {
    const { url } = await startServer();

    await expect(
      new Promise((resolve, reject) => {
        // No token query param
        const ws = new WebSocket(`${url}?room=room-secure`);
        ws.on('open', () => resolve(ws));
        ws.on('error', (err) => reject(err));
      }),
    ).rejects.toThrow();
  });

  it('rejects connection when room access validation fails with HTTP 403', async () => {
    const { url } = await startServer({
      validateRoomAccess: (_userId, roomId) => {
        // Only allow room-public, reject room-private
        return roomId !== 'room-private';
      },
    });

    // Connecting to room-private should be rejected
    await expect(connectClient(url, 'room-private', TEST_JWT)).rejects.toThrow();

    // Connecting to room-public should succeed
    const ws = await connectClient(url, 'room-public', TEST_JWT);
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('rejects participant impersonation attempts safely', async () => {
    const { url } = await startServer();
    const token = signJwt(
      { userId: 'real-user-alice', name: 'Alice', role: 'Staff SRE', avatar: 'A' },
      DEFAULT_JWT_SECRET,
    );

    const client = await connectClient(url, 'room-audit', token);

    const received: any[] = [];
    client.on('message', (raw) => {
      received.push(JSON.parse(raw.toString()));
    });

    // Attempt to impersonate 'bob-attacker'
    client.send(
      JSON.stringify({
        type: 'sync_user',
        user: {
          userId: 'bob-attacker',
          name: 'Bob Impersonator',
        },
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    // Must receive error rejecting impersonation
    const errorMsg = received.find(
      (m) => m.type === 'error' && m.code === 'forbidden_impersonation',
    );
    expect(errorMsg).toBeDefined();
    expect(errorMsg.message).toContain('Participant impersonation is rejected');
  });

  it('isolates messages between different rooms', async () => {
    const { url } = await startServer();

    const tokenA1 = signJwt({ userId: 'user-a1', name: 'A1', role: 'Dev', avatar: 'A1' });
    const tokenA2 = signJwt({ userId: 'user-a2', name: 'A2', role: 'Dev', avatar: 'A2' });
    const tokenB1 = signJwt({ userId: 'user-b1', name: 'B1', role: 'Dev', avatar: 'B1' });

    // Client A1 and A2 join room-alpha
    const clientA1 = await connectClient(url, 'room-alpha', tokenA1);
    const clientA2 = await connectClient(url, 'room-alpha', tokenA2);

    // Client B1 joins room-beta
    const clientB1 = await connectClient(url, 'room-beta', tokenB1);

    const receivedA2: any[] = [];
    clientA2.on('message', (raw) => {
      receivedA2.push(JSON.parse(raw.toString()));
    });

    const receivedB1: any[] = [];
    clientB1.on('message', (raw) => {
      receivedB1.push(JSON.parse(raw.toString()));
    });

    // Client A1 announces cursor in room-alpha
    clientA1.send(
      JSON.stringify({
        type: 'sync_user',
        user: {
          cursor: { x: 120, y: 240 },
        },
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    // Client A2 in room-alpha MUST receive sync_user with authenticated userId 'user-a1'
    const a2Sync = receivedA2.find((m) => m.type === 'sync_user' && m.user?.userId === 'user-a1');
    expect(a2Sync).toBeDefined();
    expect(a2Sync.user.cursor.x).toBe(120);

    // Client B1 in room-beta MUST NOT receive room-alpha sync_user
    const b1Sync = receivedB1.find((m) => m.type === 'sync_user' && m.user?.userId === 'user-a1');
    expect(b1Sync).toBeUndefined();
  });

  it('rejects malformed payloads safely with error message without crashing server', async () => {
    const { url } = await startServer();
    const client = await connectClient(url, 'room-validation');

    const received: any[] = [];
    client.on('message', (raw) => {
      received.push(JSON.parse(raw.toString()));
    });

    // 1. Send invalid JSON
    client.send('not valid json at all {');

    // 2. Send valid JSON but invalid schema
    client.send(JSON.stringify({ type: 'sync_user', user: { cursor: 'not an object' } }));

    await new Promise((r) => setTimeout(r, 100));

    const jsonError = received.find((m) => m.type === 'error' && m.code === 'malformed_json');
    expect(jsonError).toBeDefined();

    const schemaError = received.find(
      (m) => m.type === 'error' && m.code === 'schema_validation_failed',
    );
    expect(schemaError).toBeDefined();
  });

  it('does not duplicate participants on reconnection', async () => {
    const { url } = await startServer();
    const token = signJwt({
      userId: 'reconnecting-user',
      name: 'Reconnecting User',
      role: 'Staff SRE',
      avatar: 'RU',
    });

    // Client 1 connects
    await connectClient(url, 'room-reconnect', token);
    await connectClient(
      url,
      'room-reconnect',
      signJwt({ userId: 'observer-user', name: 'Observer', role: 'SRE', avatar: 'OB' }),
    );

    // Reconnect client 1 with same token
    const received: any[] = [];
    await connectClient(url, 'room-reconnect', token, (msg) => {
      received.push(msg);
    });

    await new Promise((r) => setTimeout(r, 100));

    // Inspect initial roster received by reconnected client
    const rosterMsg = received.find((m) => m.type === 'roster');
    expect(rosterMsg).toBeDefined();

    // Roster should not contain duplicate entries for 'reconnecting-user'
    const instances = rosterMsg.users.filter((u: any) => u.userId === 'reconnecting-user');
    expect(instances.length).toBe(1);
  });
});
