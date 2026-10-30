import { useEffect, useRef, useState } from 'react';

export interface RemoteReviewer {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly cursor: { readonly x: number; readonly y: number };
  readonly selectedNodeId?: string | null;
  readonly isSpeaking?: boolean;
}

export function useCollaborationPresence(
  currentUser: { userId: string; name: string; role: string; avatar: string },
  activeNodeId: string | null,
) {
  const [remoteReviewers, setRemoteReviewers] = useState<readonly RemoteReviewer[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/collaboration`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Announce initial user presence
      ws.send(
        JSON.stringify({
          type: 'sync_user',
          user: {
            ...currentUser,
            cursor: { x: 300, y: 200 },
            selectedNodeId: activeNodeId,
          },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as
          | { type: 'sync_user'; user: RemoteReviewer }
          | { type: 'user_left'; userId: string }
          | { type: 'roster'; users: RemoteReviewer[] }
          | { type: string };

        if (msg.type === 'sync_user') {
          const user = (msg as { user: RemoteReviewer }).user;
          setRemoteReviewers((prev) => {
            const filtered = prev.filter((u) => u.userId !== user.userId);
            return [...filtered, user];
          });
        } else if (msg.type === 'user_left') {
          const leftUserId = (msg as { userId: string }).userId;
          setRemoteReviewers((prev) => prev.filter((u) => u.userId !== leftUserId));
        } else if (msg.type === 'roster') {
          const users = (msg as { users: RemoteReviewer[] }).users;
          setRemoteReviewers(users.filter((u) => u.userId !== currentUser.userId));
        }
      } catch {
        // Ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [currentUser, activeNodeId]);

  const broadcastCursor = (x: number, y: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_user',
          user: {
            ...currentUser,
            cursor: { x, y },
            selectedNodeId: activeNodeId,
          },
        }),
      );
    }
  };

  return { remoteReviewers, broadcastCursor };
}
