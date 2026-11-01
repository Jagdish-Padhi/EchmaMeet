import { useCallback, useEffect, useRef, useState } from 'react';

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

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useCollaborationPresence(
  currentUser: { userId: string; name: string; role: string; avatar: string },
  activeNodeId: string | null,
  roomCode = 'default-room',
  localStream: MediaStream | null = null,
  onCanvasOp?: ((op: unknown) => void) | undefined,
) {
  const [remoteReviewers, setRemoteReviewers] = useState<readonly RemoteReviewer[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isMakingOfferRef = useRef<Map<string, boolean>>(new Map());
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const lastBroadcastTimeRef = useRef<number>(0);
  const onCanvasOpRef = useRef(onCanvasOp);
  onCanvasOpRef.current = onCanvasOp;

  // Clean up peer connection and associated candidate buffers
  const cleanupPeer = useCallback((peerUserId: string) => {
    const pc = peerConnectionsRef.current.get(peerUserId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      peerConnectionsRef.current.delete(peerUserId);
    }
    candidateQueueRef.current.delete(peerUserId);
    isMakingOfferRef.current.delete(peerUserId);
  }, []);

  // Drain pending ICE candidates once remote description is set
  const drainCandidateQueue = useCallback(async (peerUserId: string, pc: RTCPeerConnection) => {
    const queue = candidateQueueRef.current.get(peerUserId);
    if (!queue || queue.length === 0) return;
    candidateQueueRef.current.delete(peerUserId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Non-fatal ICE candidate processing
      }
    }
  }, []);

  // Helper to create or get peer connection
  const getOrCreatePeerConnection = useCallback(
    (targetUserId: string, ws: WebSocket): RTCPeerConnection => {
      let pc = peerConnectionsRef.current.get(targetUserId);
      if (pc && pc.signalingState !== 'closed') return pc;

      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetUserId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'webrtc_ice_candidate',
              toUserId: targetUserId,
              candidate: event.candidate,
            }),
          );
        }
      };

      pc.ontrack = (event) => {
        const stream =
          event.streams[0] ??
          (typeof MediaStream !== 'undefined' ? new MediaStream([event.track]) : null);
        if (stream) {
          setRemoteReviewers((prev) =>
            prev.map((u) => (u.userId === targetUserId ? { ...u, stream } : u)),
          );
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          if ('restartIce' in pc && typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } else if (pc.connectionState === 'closed') {
          cleanupPeer(targetUserId);
        }
      };

      // Add local stream tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (localStreamRef.current) {
            try {
              pc?.addTrack(track, localStreamRef.current);
            } catch {
              // ignore
            }
          }
        });
      }

      return pc;
    },
    [cleanupPeer],
  );

  // Initiate WebRTC call to remote peer with collision tracking
  const initiateCallToPeer = useCallback(
    async (targetUserId: string, ws: WebSocket) => {
      if (typeof RTCPeerConnection === 'undefined') return;
      try {
        isMakingOfferRef.current.set(targetUserId, true);
        const pc = getOrCreatePeerConnection(targetUserId, ws);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'webrtc_offer',
              toUserId: targetUserId,
              offer,
            }),
          );
        }
      } catch {
        // WebRTC call initiation non-fatal
      } finally {
        isMakingOfferRef.current.set(targetUserId, false);
      }
    },
    [getOrCreatePeerConnection],
  );

  // Synchronize dynamic local stream tracks across existing peer connections
  useEffect(() => {
    localStreamRef.current = localStream;
    if (typeof RTCPeerConnection === 'undefined') return;

    for (const [, pc] of peerConnectionsRef.current.entries()) {
      if (pc.signalingState === 'closed') continue;

      const senders = pc.getSenders();
      const currentTracks = localStream ? localStream.getTracks() : [];

      for (const sender of senders) {
        if (!sender.track) continue;
        const matchingTrack = currentTracks.find((t) => t.kind === sender.track?.kind);
        if (matchingTrack) {
          if (sender.track !== matchingTrack) {
            void sender.replaceTrack(matchingTrack);
          }
        } else {
          void sender.replaceTrack(null);
        }
      }

      for (const track of currentTracks) {
        const hasSender = senders.some((s) => s.track?.kind === track.kind);
        if (!hasSender && localStream) {
          try {
            pc.addTrack(track, localStream);
          } catch {
            // ignore
          }
        }
      }
    }
  }, [localStream]);

  // Main WebSocket connection effect - only reconnects when room or user ID changes
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token =
      (typeof window !== 'undefined' &&
        (window.localStorage.getItem('chaosboard_auth_token') ||
          window.sessionStorage.getItem('chaosboard_auth_token'))) ||
      'sre-session-demo-token-2026';
    const params = new URLSearchParams();
    if (roomCode) params.set('room', roomCode);
    if (token) params.set('token', token);
    const ws = new WebSocket(`${protocol}//${host}/ws/collaboration?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Announce initial user presence into the room
      ws.send(
        JSON.stringify({
          type: 'sync_user',
          user: {
            ...currentUserRef.current,
            cursor: { x: 300, y: 200 },
            selectedNodeId: activeNodeIdRef.current,
          },
        }),
      );
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        const type = msg['type'] as string;

        if (type === 'sync_user') {
          const user = msg['user'] as RemoteReviewer;
          setRemoteReviewers((prev) => {
            const filtered = prev.filter((u) => u.userId !== user.userId);
            return [...filtered, user];
          });
        } else if (type === 'user_left') {
          const leftUserId = msg['userId'] as string;
          cleanupPeer(leftUserId);
          setRemoteReviewers((prev) => prev.filter((u) => u.userId !== leftUserId));
        } else if (type === 'roster') {
          const users = (msg['users'] as RemoteReviewer[]).filter(
            (u) => u.userId !== currentUserRef.current.userId,
          );
          setRemoteReviewers(users);
          // Connect to each existing peer in the room
          for (const peer of users) {
            void initiateCallToPeer(peer.userId, ws);
          }
        } else if (type === 'webrtc_offer') {
          const fromUserId = msg['fromUserId'] as string;
          const offer = msg['offer'] as RTCSessionDescriptionInit;
          if (typeof RTCPeerConnection !== 'undefined' && fromUserId) {
            const pc = getOrCreatePeerConnection(fromUserId, ws);
            const isPolite = currentUserRef.current.userId < fromUserId;
            const offerCollision =
              pc.signalingState !== 'stable' || (isMakingOfferRef.current.get(fromUserId) ?? false);

            if (offerCollision) {
              if (!isPolite) {
                // Impolite peer discards offer during collision
                return;
              }
              // Polite peer rolls back local offer
              await pc.setLocalDescription({ type: 'rollback' });
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await drainCandidateQueue(fromUserId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'webrtc_answer',
                  toUserId: fromUserId,
                  answer,
                }),
              );
            }
          }
        } else if (type === 'webrtc_answer') {
          const fromUserId = msg['fromUserId'] as string;
          const answer = msg['answer'] as RTCSessionDescriptionInit;
          const pc = peerConnectionsRef.current.get(fromUserId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await drainCandidateQueue(fromUserId, pc);
          }
        } else if (type === 'webrtc_ice_candidate') {
          const fromUserId = msg['fromUserId'] as string;
          const candidate = msg['candidate'] as RTCIceCandidateInit;
          const pc = peerConnectionsRef.current.get(fromUserId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // Ignore invalid ICE candidate error
            }
          } else if (fromUserId) {
            // Buffer candidate until remote description is applied
            let queue = candidateQueueRef.current.get(fromUserId);
            if (!queue) {
              queue = [];
              candidateQueueRef.current.set(fromUserId, queue);
            }
            queue.push(candidate);
          }
        } else if (type === 'canvas_op') {
          onCanvasOpRef.current?.(msg);
        } else if (type === 'canvas_sync') {
          if (Array.isArray(msg['operations'])) {
            for (const singleOp of msg['operations'] as unknown[]) {
              onCanvasOpRef.current?.(singleOp);
            }
          }
        }
      } catch {
        // Non-JSON or malformed packet
      }
    };

    return () => {
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      peerConnectionsRef.current.clear();

      ws.close();
      wsRef.current = null;
    };
  }, [
    roomCode,
    currentUser.userId,
    cleanupPeer,
    getOrCreatePeerConnection,
    initiateCallToPeer,
    drainCandidateQueue,
  ]);

  // Separate effect for activeNodeId updates: sends message without reconnecting
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_user',
          user: {
            ...currentUserRef.current,
            selectedNodeId: activeNodeId,
          },
        }),
      );
    }
  }, [activeNodeId]);

  // Throttled cursor broadcast (25 Hz max)
  const broadcastCursor = useCallback((x: number, y: number) => {
    const now = performance.now();
    if (now - lastBroadcastTimeRef.current < 40) {
      return;
    }
    lastBroadcastTimeRef.current = now;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_user',
          user: {
            ...currentUserRef.current,
            cursor: { x, y },
            selectedNodeId: activeNodeIdRef.current,
          },
        }),
      );
    }
  }, []);

  // Broadcast canvas operation
  const broadcastCanvasOp = useCallback((canvasOp: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && canvasOp && typeof canvasOp === 'object') {
      const opObj = canvasOp as { opId?: string; op?: string; payload?: unknown };
      if (opObj.opId && opObj.op) {
        wsRef.current.send(
          JSON.stringify({
            type: 'canvas_op',
            opId: opObj.opId,
            op: opObj.op,
            payload: opObj.payload,
          }),
        );
      }
    }
  }, []);

  return { remoteReviewers, broadcastCursor, broadcastCanvasOp };
}
