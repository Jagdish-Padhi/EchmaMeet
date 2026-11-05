import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import { MediaStreamTrack, RTCPeerConnection, type RTCIceCandidate } from 'werift';
import {
  PeerMesh,
  type MeshSignal,
  type PeerConnectionLike,
  type SenderLike,
  type SessionDescriptionLike,
  type StreamLike,
  type TrackLike,
} from '@chaosboard/webrtc-mesh';
import { attachCollaborationWebSocketBridge } from '../collaboration-ws';
import { DEFAULT_JWT_SECRET, signJwt } from '../auth';
import { IN_MEMORY, openDatabase } from '../db';
import { runMigrations } from '../migrations';
import { moduleMigrations } from '../../module-migrations';
import { RoomRegistry } from '../rooms';
import { systemClock } from '../system-clock';

/**
 * These tests exercise REAL WebRTC: genuine ICE, DTLS and SDP negotiation between independent
 * peer connections, signaled through the production collaboration bridge over real WebSockets
 * with real JWT authentication. Nothing about the transport is mocked.
 */

// werift exposes events as subscribable emitters; adapt to the browser-style surface PeerMesh uses.
class WeriftPeer implements PeerConnectionLike {
  readonly inner = new RTCPeerConnection({ iceServers: [], iceUseIpv4: true, iceUseIpv6: false });
  onicecandidate: PeerConnectionLike['onicecandidate'] = null;
  ontrack: PeerConnectionLike['ontrack'] = null;
  onconnectionstatechange: PeerConnectionLike['onconnectionstatechange'] = null;
  onnegotiationneeded: PeerConnectionLike['onnegotiationneeded'] = null;

  constructor() {
    this.inner.onIceCandidate.subscribe((candidate: RTCIceCandidate | undefined) => {
      this.onicecandidate?.({ candidate: candidate ? candidate.toJSON() : null });
    });
    this.inner.onTrack.subscribe((track: MediaStreamTrack) => {
      this.ontrack?.({ track: track as unknown as TrackLike, streams: [] });
    });
    this.inner.connectionStateChange.subscribe(() => this.onconnectionstatechange?.());
    this.inner.onNegotiationneeded.subscribe(() => this.onnegotiationneeded?.());
  }
  get signalingState() {
    return this.inner.signalingState;
  }
  get connectionState() {
    return this.inner.connectionState;
  }
  get remoteDescription() {
    return this.inner.remoteDescription;
  }
  async createOffer() {
    return (await this.inner.createOffer()) as unknown as SessionDescriptionLike;
  }
  async createAnswer() {
    return (await this.inner.createAnswer()) as unknown as SessionDescriptionLike;
  }
  async setLocalDescription(d: SessionDescriptionLike) {
    await this.inner.setLocalDescription(d as never);
  }
  async setRemoteDescription(d: SessionDescriptionLike) {
    await this.inner.setRemoteDescription(d as never);
  }
  async addIceCandidate(c: unknown) {
    await this.inner.addIceCandidate(c as never);
  }
  addTrack(track: TrackLike) {
    return this.inner.addTrack(track as unknown as MediaStreamTrack) as unknown as SenderLike;
  }
  getSenders() {
    return this.inner.getSenders() as unknown as SenderLike[];
  }
  close() {
    void this.inner.close();
  }
}

interface Participant {
  readonly userId: string;
  readonly ws: WebSocket;
  readonly mesh: PeerMesh;
  readonly remoteKinds: Map<string, Set<string>>;
  readonly closedPeers: string[];
  localTracks: MediaStreamTrack[];
  roster: string[];
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

function startBridge(): Promise<{ port: number }> {
  const db = openDatabase(IN_MEMORY);
  runMigrations(db, moduleMigrations, systemClock);
  for (const id of ['alice', 'bob', 'carol']) {
    db.run(
      `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at) VALUES (?, ?, 'x', ?, 'SRE', ?, ?)`,
      [id, `${id}@t.test`, id, id[0] ?? 'u', new Date().toISOString()],
    );
  }
  const server: Server = createServer();
  const wss: WebSocketServer = attachCollaborationWebSocketBridge(server, {
    db,
    jwtSecret: DEFAULT_JWT_SECRET,
    rooms: new RoomRegistry(db),
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      cleanups.push(
        () =>
          new Promise<void>((done) => {
            for (const c of wss.clients) c.terminate();
            wss.close(() => {
              server.closeAllConnections();
              server.close(() => done());
            });
          }),
      );
      resolve({ port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

async function join(port: number, userId: string, withAudio = true): Promise<Participant> {
  const token = signJwt(
    { userId, name: userId, role: 'SRE', avatar: userId[0] ?? 'u' },
    DEFAULT_JWT_SECRET,
  );
  const ws = new WebSocket(
    `ws://127.0.0.1:${String(port)}/ws/collaboration?room=webrtc-room&token=${token}`,
  );
  const participant: Participant = {
    userId,
    ws,
    remoteKinds: new Map(),
    closedPeers: [],
    localTracks: withAudio ? [new MediaStreamTrack({ kind: 'audio' })] : [],
    roster: [],
    mesh: undefined as unknown as PeerMesh,
  };
  const localStream = (): StreamLike | null =>
    participant.localTracks.length === 0
      ? null
      : { getTracks: () => participant.localTracks as unknown as TrackLike[] };
  const mesh = new PeerMesh({
    selfId: userId,
    send: (m) => ws.send(JSON.stringify(m)),
    createPeerConnection: () => new WeriftPeer(),
    getIceServers: () => [],
    getLocalStream: localStream,
    onRemoteTrack: (peerId, track) => {
      const set = participant.remoteKinds.get(peerId) ?? new Set<string>();
      set.add(track.kind);
      participant.remoteKinds.set(peerId, set);
    },
    onPeerClosed: (peerId) => participant.closedPeers.push(peerId),
  });
  (participant as { mesh: PeerMesh }).mesh = mesh;
  cleanups.push(() => {
    mesh.close();
    ws.terminate();
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as Record<string, unknown> & { type: string };
    if (msg.type === 'roster') {
      const users = (msg['users'] as { userId: string }[])
        .map((u) => u.userId)
        .filter((id) => id !== userId);
      participant.roster = users;
      for (const peer of users) void mesh.connectTo(peer);
    } else if (msg.type === 'user_left') {
      mesh.peerLeft(String(msg['userId']));
    } else if (msg.type.startsWith('webrtc_')) {
      void mesh.handleSignal(msg as unknown as MeshSignal);
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  return participant;
}

async function until(predicate: () => boolean, label: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for: ${label}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('real WebRTC mesh through the production signaling server', () => {
  it('connects three peers with authenticated signaling and delivers remote tracks', async () => {
    const { port } = await startBridge();
    const alice = await join(port, 'alice');
    const bob = await join(port, 'bob');
    const carol = await join(port, 'carol');
    const all = [alice, bob, carol];

    await until(
      () =>
        all.every((p) =>
          ['alice', 'bob', 'carol']
            .filter((id) => id !== p.userId)
            .every((id) => p.mesh.connectionState(id) === 'connected'),
        ),
      'all 6 directed connections reach "connected" (real ICE + DTLS)',
    );
    for (const p of all) {
      for (const other of ['alice', 'bob', 'carol'].filter((id) => id !== p.userId)) {
        expect(p.remoteKinds.get(other)?.has('audio')).toBe(true);
      }
    }
  }, 30_000);

  it('renegotiates when a video track is added after the connection is live', async () => {
    const { port } = await startBridge();
    const alice = await join(port, 'alice');
    const bob = await join(port, 'bob');
    await until(
      () =>
        alice.mesh.connectionState('bob') === 'connected' &&
        bob.mesh.connectionState('alice') === 'connected',
      'initial connection',
    );
    expect(bob.remoteKinds.get('alice')?.has('video')).toBeFalsy();

    // Camera turned on mid-call: nothing about the connection existed for video at join time.
    alice.localTracks = [...alice.localTracks, new MediaStreamTrack({ kind: 'video' })];
    alice.mesh.syncLocalStream();
    await until(
      () => bob.remoteKinds.get('alice')?.has('video') === true,
      'bob receives alice video after renegotiation',
    );
  }, 30_000);

  it('resolves simultaneous offers (glare) without deadlock', async () => {
    const { port } = await startBridge();
    const alice = await join(port, 'alice');
    const bob = await join(port, 'bob');
    // Both sides initiate at the same instant, on top of whatever roster-driven setup already ran.
    await Promise.all([alice.mesh.connectTo('bob'), bob.mesh.connectTo('alice')]);
    await until(
      () =>
        alice.mesh.connectionState('bob') === 'connected' &&
        bob.mesh.connectionState('alice') === 'connected',
      'convergence after glare',
    );
  }, 30_000);

  it('releases the peer connection and reports closure when a participant leaves', async () => {
    const { port } = await startBridge();
    const alice = await join(port, 'alice');
    const bob = await join(port, 'bob');
    await until(() => alice.mesh.connectionState('bob') === 'connected', 'connected');
    bob.ws.close();
    await until(
      () => alice.closedPeers.includes('bob'),
      'alice observes bob leaving and closes the peer',
    );
    expect(alice.mesh.peerIds).not.toContain('bob');
  }, 30_000);
});
