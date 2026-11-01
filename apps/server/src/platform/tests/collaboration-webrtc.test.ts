import { createServer } from 'node:http';
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  attachCollaborationWebSocketBridge,
  type CollaborationBridgeOptions,
} from '../collaboration-ws';
import { signJwt, DEMO_AUTH_TOKEN, DEFAULT_JWT_SECRET } from '../auth';

describe('WebRTC Peer Signaling & Room Routing (Task 3)', () => {
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

  it('routes webrtc_offer with server-verified fromUserId directly to toUserId', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);
    const tokenC = signJwt({ userId: 'charlie', name: 'Charlie', role: 'reviewer' }, DEFAULT_JWT_SECRET);

    const clientBMessages: any[] = [];
    const clientCMessages: any[] = [];

    const wsA = await connectClient(url, 'webrtc-room-1', tokenA);
    const _wsB = await connectClient(url, 'webrtc-room-1', tokenB, (msg) => clientBMessages.push(msg));
    const _wsC = await connectClient(url, 'webrtc-room-1', tokenC, (msg) => clientCMessages.push(msg));

    // Alice sends offer targeted strictly to Bob, claiming fake fromUserId 'attacker'
    wsA.send(
      JSON.stringify({
        type: 'webrtc_offer',
        fromUserId: 'attacker-impersonator',
        toUserId: 'bob',
        offer: { type: 'offer', sdp: 'v=0\r\no=alice 123 456 IN IP4 127.0.0.1\r\ns=-\r\n' },
      }),
    );

    await new Promise((res) => setTimeout(res, 100));

    // Bob receives the offer with forced verified fromUserId 'alice'
    const bobOffer = clientBMessages.find((m) => m.type === 'webrtc_offer');
    expect(bobOffer).toBeDefined();
    expect(bobOffer.fromUserId).toBe('alice');
    expect(bobOffer.offer.sdp).toContain('o=alice');

    // Charlie must NOT receive the offer intended for Bob
    const charlieOffer = clientCMessages.find((m) => m.type === 'webrtc_offer');
    expect(charlieOffer).toBeUndefined();
  });

  it('routes webrtc_answer and webrtc_ice_candidate to intended peer', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientAMessages: any[] = [];
    const wsA = await connectClient(url, 'webrtc-room-2', tokenA, (msg) => clientAMessages.push(msg));
    const wsB = await connectClient(url, 'webrtc-room-2', tokenB);

    // Bob sends answer back to Alice
    wsB.send(
      JSON.stringify({
        type: 'webrtc_answer',
        toUserId: 'alice',
        answer: { type: 'answer', sdp: 'v=0\r\no=bob 789 012 IN IP4 127.0.0.1\r\ns=-\r\n' },
      }),
    );

    // Bob sends ICE candidate to Alice
    wsB.send(
      JSON.stringify({
        type: 'webrtc_ice_candidate',
        toUserId: 'alice',
        candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0' },
      }),
    );

    await new Promise((res) => setTimeout(res, 100));

    const answer = clientAMessages.find((m) => m.type === 'webrtc_answer');
    expect(answer).toBeDefined();
    expect(answer.fromUserId).toBe('bob');
    expect(answer.answer.sdp).toContain('o=bob');

    const candidate = clientAMessages.find((m) => m.type === 'webrtc_ice_candidate');
    expect(candidate).toBeDefined();
    expect(candidate.fromUserId).toBe('bob');
    expect(candidate.candidate.candidate).toContain('192.168.1.1');
  });

  it('prevents cross-room WebRTC signaling delivery', async () => {
    const { url } = await startServer();
    const tokenA = signJwt({ userId: 'alice', name: 'Alice', role: 'admin' }, DEFAULT_JWT_SECRET);
    const tokenB = signJwt({ userId: 'bob', name: 'Bob', role: 'engineer' }, DEFAULT_JWT_SECRET);

    const clientBMessages: any[] = [];
    // Alice in room-X, Bob in room-Y
    const wsA = await connectClient(url, 'room-x', tokenA);
    const _wsB = await connectClient(url, 'room-y', tokenB, (msg) => clientBMessages.push(msg));

    wsA.send(
      JSON.stringify({
        type: 'webrtc_offer',
        toUserId: 'bob',
        offer: { type: 'offer', sdp: 'dummy-cross-room-sdp' },
      }),
    );

    await new Promise((res) => setTimeout(res, 100));

    // Bob must receive nothing because Alice is in a different room
    const bobOffer = clientBMessages.find((m) => m.type === 'webrtc_offer');
    expect(bobOffer).toBeUndefined();
  });
});
