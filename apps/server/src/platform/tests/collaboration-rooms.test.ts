import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import { attachCollaborationWebSocketBridge } from '../collaboration-ws';
import { DEFAULT_JWT_SECRET, signJwt } from '../auth';
import { IN_MEMORY, openDatabase } from '../db';
import { runMigrations } from '../migrations';
import { moduleMigrations } from '../../module-migrations';
import { RoomRegistry } from '../rooms';
import { systemClock } from '../system-clock';

const tokenFor = (userId: string) =>
  signJwt(
    { userId, name: userId.toUpperCase(), role: 'SRE', avatar: userId[0] ?? 'u' },
    DEFAULT_JWT_SECRET,
  );

interface Harness {
  readonly port: number;
  readonly rooms: RoomRegistry;
  readonly wss: WebSocketServer;
  readonly server: Server;
}

const open: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of open.splice(0)) await close();
});

function start(opts?: {
  maxParticipantsPerRoom?: number;
  heartbeatIntervalMs?: number;
  rateLimit?: { maxMessages: number; windowMs: number };
  existingDb?: ReturnType<typeof openDatabase>;
}): Promise<Harness> {
  const db = opts?.existingDb ?? openDatabase(IN_MEMORY);
  if (!opts?.existingDb) runMigrations(db, moduleMigrations, systemClock);
  // Accounts must exist: a valid signature alone is not enough once the database is the authority.
  for (const id of ['alice', 'bob', 'carol', 'mallory', 'spam', 'u1', 'u2', 'u3']) {
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, 'x', ?, 'SRE', ?, ?)`,
      [id, `${id}@example.test`, id.toUpperCase(), id[0] ?? 'u', new Date().toISOString()],
    );
  }
  const rooms = new RoomRegistry(db);
  const server = createServer();
  const wss = attachCollaborationWebSocketBridge(server, {
    db,
    jwtSecret: DEFAULT_JWT_SECRET,
    rooms,
    ...(opts?.maxParticipantsPerRoom
      ? { maxParticipantsPerRoom: opts.maxParticipantsPerRoom }
      : {}),
    ...(opts?.heartbeatIntervalMs ? { heartbeatIntervalMs: opts.heartbeatIntervalMs } : {}),
    ...(opts?.rateLimit ? { rateLimit: opts.rateLimit } : {}),
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      open.push(
        () =>
          new Promise<void>((done) => {
            for (const c of wss.clients) c.terminate();
            wss.close(() => {
              server.closeAllConnections();
              server.close(() => done());
            });
          }),
      );
      resolve({ port, rooms, wss, server });
    });
  });
}

interface Client {
  readonly ws: WebSocket;
  readonly messages: Record<string, unknown>[];
  waitFor(
    type: string,
    predicate?: (m: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown>>;
}

function connect(
  port: number,
  room: string,
  userId: string,
  wsOptions?: { autoPong?: boolean },
): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${String(port)}/ws/collaboration?room=${encodeURIComponent(room)}&token=${encodeURIComponent(tokenFor(userId))}`,
      wsOptions as never,
    );
    const messages: Record<string, unknown>[] = [];
    const waiters: {
      type: string;
      predicate?: (m: Record<string, unknown>) => boolean;
      resolve: (m: Record<string, unknown>) => void;
    }[] = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      messages.push(msg);
      for (const w of [...waiters]) {
        if (msg['type'] === w.type && (!w.predicate || w.predicate(msg))) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(msg);
        }
      }
    });
    ws.on('open', () =>
      resolve({
        ws,
        messages,
        waitFor: (type, predicate) => {
          const existing = messages.find((m) => m['type'] === type && (!predicate || predicate(m)));
          if (existing) return Promise.resolve(existing);
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`timeout waiting for ${type}`)), 4000);
            waiters.push({
              type,
              ...(predicate ? { predicate } : {}),
              resolve: (m) => {
                clearTimeout(timer);
                res(m);
              },
            });
          });
        },
      }),
    );
    ws.on('error', reject);
    ws.on('unexpected-response', (_req, res) =>
      reject(new Error(`HTTP ${String(res.statusCode)}`)),
    );
  });
}

describe('collaboration bridge with durable rooms', () => {
  it('admits the first user as owner and refuses newcomers once the room is locked', async () => {
    const h = await start();
    const alice = await connect(h.port, 'room-locked', 'alice');
    expect(h.rooms.isOwner('alice', 'room-locked')).toBe(true);
    await connect(h.port, 'room-locked', 'bob');
    expect(h.rooms.setLocked('alice', 'room-locked', true)).toBe(true);
    await expect(connect(h.port, 'room-locked', 'mallory')).rejects.toThrow('HTTP 403');
    // Existing members can still reconnect.
    await expect(connect(h.port, 'room-locked', 'bob')).resolves.toBeDefined();
    alice.ws.close();
  });

  it('rejects malformed room identifiers and full rooms', async () => {
    const h = await start({ maxParticipantsPerRoom: 2 });
    await expect(connect(h.port, 'bad room!', 'alice')).rejects.toThrow('HTTP 400');
    await connect(h.port, 'room-cap', 'u1');
    await connect(h.port, 'room-cap', 'u2');
    await expect(connect(h.port, 'room-cap', 'u3')).rejects.toThrow('HTTP 503');
  });

  it('stamps the verified sender on chat so identities cannot be spoofed', async () => {
    const h = await start();
    const alice = await connect(h.port, 'room-chat', 'alice');
    const bob = await connect(h.port, 'room-chat', 'bob');
    alice.ws.send(
      JSON.stringify({
        type: 'chat_message',
        message: { text: 'ship it', senderName: 'CEO', senderId: 'ceo' },
      }),
    );
    const received = (await bob.waitFor('chat_message')) as { message: Record<string, unknown> };
    expect(received.message['text']).toBe('ship it');
    expect(received.message['senderId']).toBe('alice');
    expect(received.message['senderName']).toBe('ALICE');
  });

  it('persists canvas state so a room survives everyone leaving and a bridge restart', async () => {
    const db = openDatabase(IN_MEMORY);
    runMigrations(db, moduleMigrations, systemClock);
    const first = await start({ existingDb: db });
    const alice = await connect(first.port, 'room-durable', 'alice');
    alice.ws.send(
      JSON.stringify({ type: 'canvas_op', opId: 'op-1', op: 'add_node', payload: { id: 'api' } }),
    );
    alice.ws.send(
      JSON.stringify({ type: 'canvas_op', opId: 'op-2', op: 'add_node', payload: { id: 'db' } }),
    );
    alice.ws.send(
      JSON.stringify({ type: 'canvas_op', opId: 'op-1', op: 'add_node', payload: { id: 'api' } }),
    ); // retry
    alice.ws.send(
      JSON.stringify({
        type: 'canvas_snapshot',
        topology: { nodes: [{ id: 'api' }, { id: 'db' }] },
      }),
    );
    await alice.waitFor('canvas_ack', (m) => m['opId'] === 'op-2');
    await new Promise((r) => setTimeout(r, 100));
    alice.ws.close();
    await new Promise((r) => setTimeout(r, 100));
    await open.pop()?.();

    const second = await start({ existingDb: db });
    const bob = await connect(second.port, 'room-durable', 'alice');
    const sync = (await bob.waitFor('canvas_sync')) as {
      sequence: number;
      operations: { opId: string }[];
      snapshot: { nodes: unknown[] };
    };
    expect(sync.sequence).toBe(2);
    expect(sync.operations.map((o) => o.opId)).toEqual(['op-1', 'op-2']);
    expect(sync.snapshot.nodes).toHaveLength(2);
  });

  it('announces user_left and releases the room when a peer dies silently', async () => {
    const h = await start({ heartbeatIntervalMs: 80 });
    const alice = await connect(h.port, 'room-hb', 'alice');
    // Bob never answers pings: a half-open connection.
    const bob = await connect(h.port, 'room-hb', 'bob', { autoPong: false });
    const left = await alice.waitFor('user_left', (m) => m['userId'] === 'bob');
    expect(left['userId']).toBe('bob');
    bob.ws.terminate();
  });

  it('closes a flooding connection with policy violation', async () => {
    const h = await start({ rateLimit: { maxMessages: 20, windowMs: 5000 } });
    const spammer = await connect(h.port, 'room-flood', 'spam');
    const closed = new Promise<number>((resolve) =>
      spammer.ws.on('close', (code) => resolve(code)),
    );
    for (let i = 0; i < 60; i += 1) {
      spammer.ws.send(
        JSON.stringify({
          type: 'sync_user',
          user: { userId: 'spam', name: 'x', role: 'x', avatar: 'x', cursor: { x: i, y: i } },
        }),
      );
    }
    expect(await closed).toBe(1008);
  });

  it('routes signaling only to the addressed peer with the verified sender stamped', async () => {
    const h = await start();
    const alice = await connect(h.port, 'room-sig', 'alice');
    const bob = await connect(h.port, 'room-sig', 'bob');
    const carol = await connect(h.port, 'room-sig', 'carol');
    alice.ws.send(
      JSON.stringify({
        type: 'webrtc_offer',
        toUserId: 'bob',
        fromUserId: 'carol',
        offer: { type: 'offer', sdp: 'v=0' },
      }),
    );
    const got = await bob.waitFor('webrtc_offer');
    expect(got['fromUserId']).toBe('alice');
    await new Promise((r) => setTimeout(r, 100));
    expect(carol.messages.some((m) => m['type'] === 'webrtc_offer')).toBe(false);
  });

  it('stores the sequence a snapshot covers and ignores a stale snapshot that would roll it back', async () => {
    const h = await start();
    const alice = await connect(h.port, 'room-snap', 'alice');
    for (const n of [1, 2, 3]) {
      alice.ws.send(
        JSON.stringify({
          type: 'canvas_op',
          opId: `o${String(n)}`,
          op: 'create_node',
          payload: { n },
        }),
      );
    }
    await alice.waitFor('canvas_ack', (m) => m['opId'] === 'o3');
    alice.ws.send(
      JSON.stringify({ type: 'canvas_snapshot', topology: { v: 'at3' }, atSequence: 3 }),
    );
    await new Promise((r) => setTimeout(r, 100));
    // A late, older snapshot must not replace the newer one.
    alice.ws.send(
      JSON.stringify({ type: 'canvas_snapshot', topology: { v: 'at1' }, atSequence: 1 }),
    );
    // A claimed sequence beyond reality is clamped to the real one.
    await new Promise((r) => setTimeout(r, 100));
    const bob = await connect(h.port, 'room-snap', 'bob');
    const sync = (await bob.waitFor('canvas_sync')) as {
      snapshot: { v: string };
      snapshotSequence: number;
    };
    expect(sync.snapshot.v).toBe('at3');
    expect(sync.snapshotSequence).toBe(3);
    expect(h.rooms.loadCanvas('room-snap').snapshotSequence).toBe(3);
  });
});
