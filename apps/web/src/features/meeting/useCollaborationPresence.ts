import { useCallback, useEffect, useRef, useState } from 'react';
import { planCanvasSync } from './canvas-sync';
import {
  PeerMesh,
  ReconnectingSocket,
  type IceServerLike,
  type MeshSignal,
  type PeerConnectionLike,
  type SocketLike,
  type TrackLike,
} from '@chaosboard/webrtc-mesh';

export interface RemoteReviewer {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly cursor: { readonly x: number; readonly y: number };
  readonly selectedNodeId?: string | null | undefined;
  readonly isSpeaking?: boolean | undefined;
  readonly stream?: MediaStream | null | undefined;
}

const FALLBACK_ICE: readonly IceServerLike[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function readSessionToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem('chaosboard_token') ??
    window.sessionStorage.getItem('chaosboard_token') ??
    ''
  );
}

interface IceCache {
  servers: readonly IceServerLike[];
  expiresAtMs: number;
}

async function fetchIceServers(roomCode: string, cache: { current: IceCache | null }) {
  const now = Date.now();
  if (cache.current && cache.current.expiresAtMs - 60_000 > now) return cache.current.servers;
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/ice-servers`, {
      headers: { authorization: `Bearer ${readSessionToken()}` },
    });
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    const body = (await res.json()) as {
      iceServers: IceServerLike[];
      expiresAt: number | null;
    };
    const servers = body.iceServers.length > 0 ? body.iceServers : FALLBACK_ICE;
    cache.current = {
      servers,
      expiresAtMs: body.expiresAt ? body.expiresAt * 1000 : now + 10 * 60_000,
    };
    return servers;
  } catch {
    // Without server-issued credentials we still attempt STUN-only connectivity.
    return FALLBACK_ICE;
  }
}

export function useCollaborationPresence(
  currentUser: { userId: string; name: string; role: string; avatar: string },
  activeNodeId: string | null,
  roomCode = 'default-room',
  localStream: MediaStream | null = null,
  onCanvasOp?: ((op: unknown) => void) | undefined,
  onCanvasSnapshot?: ((snapshot: unknown) => void) | undefined,
) {
  const [isSynced, setIsSynced] = useState(false);
  const [remoteReviewers, setRemoteReviewers] = useState<readonly RemoteReviewer[]>([]);
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const meshRef = useRef<PeerMesh | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const lastSequenceRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const lastBroadcastTimeRef = useRef<number>(0);
  const onCanvasOpRef = useRef(onCanvasOp);
  onCanvasOpRef.current = onCanvasOp;
  const onCanvasSnapshotRef = useRef(onCanvasSnapshot);
  onCanvasSnapshotRef.current = onCanvasSnapshot;

  const sendJson = useCallback((payload: unknown): boolean => {
    return socketRef.current?.send(payload) ?? false;
  }, []);

  // Keep every live peer connection in step with the local camera / microphone / screen stream.
  useEffect(() => {
    meshRef.current?.syncLocalStream();
  }, [localStream]);

  // Socket + mesh lifecycle: re-created only when the room or the signed-in user changes.
  useEffect(() => {
    const iceCache: { current: IceCache | null } = { current: null };
    const selfId = currentUser.userId;
    remoteStreamsRef.current = new Map();
    lastSequenceRef.current = 0;
    setIsSynced(false);

    const attachStream = (peerId: string, stream: MediaStream | null) => {
      setRemoteReviewers((prev) => prev.map((u) => (u.userId === peerId ? { ...u, stream } : u)));
    };

    const mesh = new PeerMesh({
      selfId,
      send: (message) => {
        sendJson(message);
      },
      createPeerConnection: (iceServers) =>
        new RTCPeerConnection({
          iceServers: [...iceServers] as RTCIceServer[],
        }) as unknown as PeerConnectionLike,
      getIceServers: () => fetchIceServers(roomCode, iceCache),
      getLocalStream: () => localStreamRef.current,
      onRemoteTrack: (peerId, track: TrackLike, streams) => {
        // Prefer the stream the sender grouped the track in; otherwise assemble one per peer.
        const provided = streams[0] as unknown as MediaStream | undefined;
        let stream = provided ?? remoteStreamsRef.current.get(peerId);
        if (!stream) stream = new MediaStream();
        if (!provided && !stream.getTracks().some((t) => t.id === track.id)) {
          stream.addTrack(track as unknown as MediaStreamTrack);
        }
        remoteStreamsRef.current.set(peerId, stream);
        attachStream(peerId, stream);
      },
      onPeerClosed: (peerId) => {
        remoteStreamsRef.current.delete(peerId);
        attachStream(peerId, null);
      },
    });
    meshRef.current = mesh;

    const handleMessage = (raw: unknown) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return; // not a collaboration frame
      }
      const type = msg['type'];

      switch (type) {
        case 'sync_user': {
          const user = msg['user'] as RemoteReviewer;
          setRemoteReviewers((prev) => {
            const existing = prev.find((u) => u.userId === user.userId);
            const merged = {
              ...user,
              stream: existing?.stream ?? remoteStreamsRef.current.get(user.userId) ?? null,
            };
            return [...prev.filter((u) => u.userId !== user.userId), merged];
          });
          break;
        }
        case 'user_left': {
          const leftUserId = String(msg['userId']);
          mesh.peerLeft(leftUserId);
          setRemoteReviewers((prev) => prev.filter((u) => u.userId !== leftUserId));
          break;
        }
        case 'roster': {
          const users = (msg['users'] as RemoteReviewer[]).filter((u) => u.userId !== selfId);
          setRemoteReviewers(
            users.map((u) => ({ ...u, stream: remoteStreamsRef.current.get(u.userId) ?? null })),
          );
          // After a reconnect, drop peers that left while the socket was down.
          const present = new Set(users.map((u) => u.userId));
          for (const peerId of mesh.peerIds) {
            if (!present.has(peerId)) mesh.peerLeft(peerId);
          }
          // The side that joins dials everyone already in the room.
          for (const peer of users) void mesh.connectTo(peer.userId);
          break;
        }
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate':
          void mesh.handleSignal(msg as unknown as MeshSignal).catch(() => {
            // A failed negotiation step is recovered by ICE restart / renegotiation.
          });
          break;
        case 'canvas_op': {
          const sequence = typeof msg['sequence'] === 'number' ? msg['sequence'] : 0;
          if (sequence > lastSequenceRef.current) lastSequenceRef.current = sequence;
          onCanvasOpRef.current?.(msg);
          break;
        }
        case 'canvas_sync': {
          const plan = planCanvasSync({
            lastSequence: lastSequenceRef.current,
            serverSequence: typeof msg['sequence'] === 'number' ? msg['sequence'] : 0,
            snapshotSequence:
              typeof msg['snapshotSequence'] === 'number' ? msg['snapshotSequence'] : 0,
            hasSnapshot: Boolean(msg['snapshot']),
            operations: Array.isArray(msg['operations'])
              ? (msg['operations'] as { sequence?: number }[])
              : [],
          });
          if (plan.useSnapshot) onCanvasSnapshotRef.current?.(msg['snapshot']);
          for (const op of plan.operations) onCanvasOpRef.current?.(op);
          lastSequenceRef.current = plan.nextSequence;
          setIsSynced(true);
          break;
        }
        default:
          break;
      }
    };

    const socket = new ReconnectingSocket({
      createSocket: () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = new URLSearchParams({ room: roomCode, token: readSessionToken() });
        return new WebSocket(
          `${protocol}//${window.location.host}/ws/collaboration?${params.toString()}`,
        ) as unknown as SocketLike;
      },
      onMessage: handleMessage,
      onOpen: (isReconnect) => {
        socket.send({
          type: 'sync_user',
          user: {
            ...currentUserRef.current,
            cursor: { x: 300, y: 200 },
            selectedNodeId: activeNodeIdRef.current,
          },
        });
        if (isReconnect) {
          // Ask for exactly the operations missed while offline.
          socket.send({ type: 'canvas_replay_request', afterSequence: lastSequenceRef.current });
        }
      },
    });
    socketRef.current = socket;
    socket.start();

    return () => {
      socket.stop();
      mesh.close();
      socketRef.current = null;
      meshRef.current = null;
      remoteStreamsRef.current = new Map();
    };
    // currentUser.userId deliberately identifies the user for the connection's lifetime.
  }, [roomCode, currentUser.userId, sendJson]);

  // Selected-node updates reuse the open connection.
  useEffect(() => {
    sendJson({
      type: 'sync_user',
      user: { ...currentUserRef.current, selectedNodeId: activeNodeId },
    });
  }, [activeNodeId, sendJson]);

  // Throttled cursor broadcast (25 Hz max)
  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      const now = performance.now();
      if (now - lastBroadcastTimeRef.current < 40) return;
      lastBroadcastTimeRef.current = now;
      sendJson({
        type: 'sync_user',
        user: {
          ...currentUserRef.current,
          cursor: { x, y },
          selectedNodeId: activeNodeIdRef.current,
        },
      });
    },
    [sendJson],
  );

  const broadcastCanvasOp = useCallback(
    (canvasOp: unknown) => {
      if (canvasOp && typeof canvasOp === 'object') {
        const opObj = canvasOp as { opId?: string; op?: string; payload?: unknown };
        if (opObj.opId && opObj.op) {
          sendJson({ type: 'canvas_op', opId: opObj.opId, op: opObj.op, payload: opObj.payload });
        }
      }
    },
    [sendJson],
  );

  // Lets the room recover its canvas even after old operations have been trimmed.
  const broadcastCanvasSnapshot = useCallback(
    (topology: unknown) => {
      sendJson({ type: 'canvas_snapshot', topology, atSequence: lastSequenceRef.current });
    },
    [sendJson],
  );

  return { remoteReviewers, broadcastCursor, broadcastCanvasOp, broadcastCanvasSnapshot, isSynced };
}
