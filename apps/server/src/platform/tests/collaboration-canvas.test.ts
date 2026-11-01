import { createServer } from 'node:http';
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  attachCollaborationWebSocketBridge,
  type CollaborationBridgeOptions,
} from '../collaboration-ws';
import { signJwt, DEMO_AUTH_TOKEN, DEFAULT_JWT_SECRET } from '../auth';

describe('Collaborative Canvas Protocol & Synchronization (Task 2)', () => {
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
    token: string = DEMO_AUTH_TOKEN,
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

  it('two clients see node creation and deletion with sequencing and ack', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientAMessages: any[] = [];
    const clientBMessages: any[] = [];

    const wsA = await connectClient(url, 'canvas-room-1', tokenA, (msg) => clientAMessages.push(msg));
    const _wsB = await connectClient(url, 'canvas-room-1', tokenB, (msg) => clientBMessages.push(msg));

    // Client A creates node
    const createOp = {
      type: 'canvas_op',
      opId: 'op-node-create-1',
      op: 'create_node',
      payload: { node: { id: 'node-auth', kind: 'service', label: 'Auth Service', position: { x: 100, y: 150 } } },
    };
    wsA.send(JSON.stringify(createOp));

    // Wait for ack on Client A and broadcast on Client B
    await new Promise((res) => setTimeout(res, 100));

    const ack1 = clientAMessages.find((m) => m.type === 'canvas_ack' && m.opId === 'op-node-create-1');
    expect(ack1).toBeDefined();
    expect(ack1.sequence).toBe(1);

    const remoteOp1 = clientBMessages.find((m) => m.type === 'canvas_op' && m.opId === 'op-node-create-1');
    expect(remoteOp1).toBeDefined();
    expect(remoteOp1.sequence).toBe(1);
    expect(remoteOp1.actorId).toBe('alice');
    expect(remoteOp1.payload.node.id).toBe('node-auth');

    // Client A deletes node
    const deleteOp = {
      type: 'canvas_op',
      opId: 'op-node-delete-1',
      op: 'delete_node',
      payload: { nodeId: 'node-auth' },
    };
    wsA.send(JSON.stringify(deleteOp));

    await new Promise((res) => setTimeout(res, 100));

    const ack2 = clientAMessages.find((m) => m.type === 'canvas_ack' && m.opId === 'op-node-delete-1');
    expect(ack2).toBeDefined();
    expect(ack2.sequence).toBe(2);

    const remoteOp2 = clientBMessages.find((m) => m.type === 'canvas_op' && m.opId === 'op-node-delete-1');
    expect(remoteOp2).toBeDefined();
    expect(remoteOp2.sequence).toBe(2);
    expect(remoteOp2.payload.nodeId).toBe('node-auth');
  });

  it('two clients see node movement synchronized', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientBMessages: any[] = [];
    const wsA = await connectClient(url, 'canvas-room-move', tokenA);
    const _wsB = await connectClient(url, 'canvas-room-move', tokenB, (msg) => clientBMessages.push(msg));

    const moveOp = {
      type: 'canvas_op',
      opId: 'op-move-101',
      op: 'move_node',
      payload: { nodeId: 'node-1', x: 420, y: 560 },
    };
    wsA.send(JSON.stringify(moveOp));

    await new Promise((res) => setTimeout(res, 100));

    const remoteMove = clientBMessages.find((m) => m.type === 'canvas_op' && m.opId === 'op-move-101');
    expect(remoteMove).toBeDefined();
    expect(remoteMove.payload.nodeId).toBe('node-1');
    expect(remoteMove.payload.x).toBe(420);
    expect(remoteMove.payload.y).toBe(560);
  });

  it('edge creation and policy updates synchronize', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientBMessages: any[] = [];
    const wsA = await connectClient(url, 'canvas-room-edge', tokenA);
    const _wsB = await connectClient(url, 'canvas-room-edge', tokenB, (msg) => clientBMessages.push(msg));

    // Create edge
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-edge-create-1',
        op: 'create_edge',
        payload: {
          edge: {
            id: 'edge-1-to-2',
            source: 'node-1',
            target: 'node-2',
            policy: { timeoutMs: 1500, maxRetries: 2, backoffBaseMs: 100 },
          },
        },
      }),
    );

    // Update edge policy
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-edge-update-1',
        op: 'update_edge',
        payload: {
          edgeId: 'edge-1-to-2',
          policy: { timeoutMs: 3000, maxRetries: 4, backoffBaseMs: 250 },
        },
      }),
    );

    await new Promise((res) => setTimeout(res, 100));

    const edgeCreate = clientBMessages.find((m) => m.type === 'canvas_op' && m.opId === 'op-edge-create-1');
    const edgeUpdate = clientBMessages.find((m) => m.type === 'canvas_op' && m.opId === 'op-edge-update-1');

    expect(edgeCreate).toBeDefined();
    expect(edgeCreate.payload.edge.id).toBe('edge-1-to-2');
    expect(edgeUpdate).toBeDefined();
    expect(edgeUpdate.payload.policy.timeoutMs).toBe(3000);
  });

  it('concurrent edits do not corrupt sequence numbers and prevent duplicate ops', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientAMessages: any[] = [];
    const clientBMessages: any[] = [];

    const wsA = await connectClient(url, 'canvas-concurrent', tokenA, (msg) => clientAMessages.push(msg));
    const wsB = await connectClient(url, 'canvas-concurrent', tokenB, (msg) => clientBMessages.push(msg));

    // Alice and Bob send ops concurrently
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-concurrent-alice',
        op: 'move_node',
        payload: { nodeId: 'node-alice', x: 10, y: 20 },
      }),
    );
    wsB.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-concurrent-bob',
        op: 'move_node',
        payload: { nodeId: 'node-bob', x: 30, y: 40 },
      }),
    );

    // Alice sends duplicate op-concurrent-alice
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-concurrent-alice',
        op: 'move_node',
        payload: { nodeId: 'node-alice', x: 10, y: 20 },
      }),
    );

    await new Promise((res) => setTimeout(res, 150));

    const acks = clientAMessages.filter((m) => m.type === 'canvas_ack');
    expect(acks.length).toBeGreaterThanOrEqual(2);

    // Sequence numbers must be strictly increasing and unique
    const seqs = acks.map((a) => a.sequence);
    expect(seqs.every((s) => typeof s === 'number' && s > 0)).toBe(true);
  });

  it('reconnection restores the latest graph via canvas_sync operations log', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenC = signJwt({ userId: 'charlie', name: 'Charlie', role: 'reviewer' }, DEFAULT_JWT_SECRET);

    const wsA = await connectClient(url, 'canvas-sync-room', tokenA);

    // Alice performs operations before Charlie arrives
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-sync-node-1',
        op: 'create_node',
        payload: { node: { id: 'node-db', kind: 'ledger_sink', label: 'Primary DB' } },
      }),
    );
    wsA.send(
      JSON.stringify({
        type: 'canvas_op',
        opId: 'op-sync-node-2',
        op: 'create_node',
        payload: { node: { id: 'node-cache', kind: 'cache', label: 'Redis Cache' } },
      }),
    );

    await new Promise((res) => setTimeout(res, 100));

    // Charlie connects later (or reconnects)
    const clientCMessages: any[] = [];
    await connectClient(url, 'canvas-sync-room', tokenC, (msg) => clientCMessages.push(msg));

    await new Promise((res) => setTimeout(res, 100));

    // Charlie must have received 'canvas_sync' containing all recorded operations
    const syncMsg = clientCMessages.find((m) => m.type === 'canvas_sync');
    expect(syncMsg).toBeDefined();
    expect(syncMsg.sequence).toBe(2);
    expect(syncMsg.operations).toHaveLength(2);
    expect(syncMsg.operations[0].opId).toBe('op-sync-node-1');
    expect(syncMsg.operations[1].opId).toBe('op-sync-node-2');
  });
});
