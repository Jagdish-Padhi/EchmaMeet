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
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const lastBroadcastTimeRef = useRef<number>(0);
  const onCanvasOpRef = useRef(onCanvasOp);
  onCanvasOpRef.current = onCanvasOp;

  // Clean up peer connection
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
  }, []);

  // Helper to create or get peer connection
  const getOrCreatePeerConnection = useCallback(
    (targetUserId: string, ws: WebSocket): RTCPeerConnection => {
      let pc = peerConnectionsRef.current.get(targetUserId);
      if (pc) return pc;

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
        const stream = event.streams[0];
        if (stream) {
          setRemoteReviewers((prev) =>
            prev.map((u) => (u.userId === targetUserId ? { ...u, stream } : u)),
          );
        }
      };

      // Add local stream tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (localStreamRef.current) {
            pc?.addTrack(track, localStreamRef.current);
          }
        });
      }

      return pc;
    },
    [],
  );

  // Initiate WebRTC call to remote peer
  const initiateCallToPeer = useCallback(
    async (targetUserId: string, ws: WebSocket) => {
      if (typeof RTCPeerConnection === 'undefined') return;
      try {
        const pc = getOrCreatePeerConnection(targetUserId, ws);
        const offer = await pc.createOffer();
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
      }
    },
    [getOrCreatePeerConnection],
  );

  // Main WebSocket connection effect - only reconnects when room or user ID changes
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const roomQuery = roomCode ? `?room=${encodeURIComponent(roomCode)}` : '';
    const ws = new WebSocket(`${protocol}//${host}/ws/collaboration${roomQuery}`);
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
          if (typeof RTCPeerConnection !== 'undefined') {
            const pc = getOrCreatePeerConnection(fromUserId, ws);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } else if (type === 'webrtc_ice_candidate') {
          const fromUserId = msg['fromUserId'] as string;
          const candidate = msg['candidate'] as RTCIceCandidateInit;
          const pc = peerConnectionsRef.current.get(fromUserId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } else if (type === 'canvas_op') {
          onCanvasOpRef.current?.(msg['op']);
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
  }, [roomCode, currentUser.userId, cleanupPeer, getOrCreatePeerConnection, initiateCallToPeer]);

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
  const broadcastCanvasOp = useCallback((op: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'canvas_op',
          op,
        }),
      );
    }
  }, []);

  return { remoteReviewers, broadcastCursor, broadcastCanvasOp };
}
