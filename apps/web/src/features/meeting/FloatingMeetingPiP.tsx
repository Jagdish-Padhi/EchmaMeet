import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '../toast';
import { LeaveMeetingModal } from './LeaveMeetingModal';
import { useMeetingMediaStream } from './useMeetingMediaStream';
import type { RemoteReviewer } from './useCollaborationPresence';
import type { MeetingChatMessage } from './agentTypes';
import type { SreHazard } from './types';
import { MeetingBubble } from './components/MeetingBubble';
import { MeetingFullscreenStage } from './components/MeetingFullscreenStage';
import { MeetingFloatingWindow } from './components/MeetingFloatingWindow';

export interface FloatingMeetingPiPProps {
  readonly isActive: boolean;
  readonly roomCode: string;
  readonly aiRaisedHand: boolean;
  readonly isEvaluatingAi?: boolean | undefined;
  readonly onAskAiOpinion?: ((prompt?: string) => void) | undefined;
  readonly onOpenSreFinding: () => void;
  readonly onLeaveMeeting: () => void;
  readonly currentUser?:
    | {
        readonly name: string;
        readonly role: string;
        readonly avatar: string;
      }
    | undefined;
  readonly remoteReviewers?: readonly RemoteReviewer[] | undefined;
  readonly hazardsCount?: number | undefined;
  readonly spokenOpinion?: string | undefined;
  readonly hazards?: readonly SreHazard[] | undefined;
  readonly externalMedia?: ReturnType<typeof useMeetingMediaStream> | undefined;
}

type WindowMode = 'minimized' | 'floating' | 'fullscreen';

export function FloatingMeetingPiP({
  isActive,
  roomCode,
  aiRaisedHand,
  isEvaluatingAi,
  onAskAiOpinion,
  onOpenSreFinding,
  onLeaveMeeting,
  currentUser = { name: 'Alex Chen', role: 'Staff SRE', avatar: 'AC' },
  remoteReviewers = [],
  hazardsCount = 0,
  spokenOpinion,
  hazards = [],
  externalMedia,
}: FloatingMeetingPiPProps) {
  const toast = useToast();
  const [windowMode, setWindowMode] = useState<WindowMode>('floating');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSideDrawer, setActiveSideDrawer] = useState<'none' | 'people' | 'chat'>('none');
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const lastRecordedSpokenRef = useRef<string | null>(null);

  // Live-cast Echma opinions and identified architecture risks directly into the chat stream!
  useEffect(() => {
    if (spokenOpinion && spokenOpinion !== lastRecordedSpokenRef.current) {
      lastRecordedSpokenRef.current = spokenOpinion;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const primaryRisk = hazards.length > 0 ? hazards[0] : undefined;

      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sender: 'Echma',
          role: 'AI Principal SRE',
          text: spokenOpinion,
          timestamp: timeStr,
          isAi: true,
          hazardBadge: primaryRisk
            ? {
                severity: primaryRisk.severity,
                title: primaryRisk.title,
                recommendation: primaryRisk.recommendation,
              }
            : undefined,
        },
      ]);
    }
  }, [spokenOpinion, hazards]);

  const handleSendMessage = useCallback(
    (text: string) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const userMsg: MeetingChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: currentUser.name || 'You',
        role: currentUser.role || 'Host',
        text,
        timestamp: timeStr,
        isAi: false,
      };

      setChatMessages((prev) => [...prev, userMsg]);

      // Echma actively monitors chat context and responds when queried
      if (onAskAiOpinion) {
        onAskAiOpinion(text);
      }
    },
    [currentUser, onAskAiOpinion],
  );

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const windowRef = useRef<HTMLDivElement>(null);

  const internalMedia = useMeetingMediaStream({
    autoStart: isActive && !externalMedia,
    onPermissionError: (msg) => {
      toast.warning(msg, 'Media Devices');
    },
  });

  const {
    localStream,
    screenStream,
    isMuted,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
    audioLevel,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    stopAllMedia,
  } = externalMedia ?? internalMedia;

  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (selfVideoRef.current) {
      selfVideoRef.current.srcObject = localStream && isVideoOn ? localStream : null;
    }
  }, [localStream, isVideoOn, windowMode]);

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream ?? null;
    }
  }, [screenStream, windowMode]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' && windowMode === 'fullscreen') {
        setWindowMode('floating');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, windowMode]);

  if (!isActive) return null;

  const handleConfirmLeave = () => {
    stopAllMedia();
    setShowLeaveModal(false);
    onLeaveMeeting();
    toast.info('You left the review meeting.', 'Meeting Ended');
  };

  const handleCopyLink = () => {
    const inviteText = `${window.location.origin}/#/studio?meeting=${encodeURIComponent(roomCode)}`;
    navigator.clipboard
      .writeText(inviteText)
      .then(() => {
        setCopied(true);
        toast.success(`Meeting code ${roomCode} copied to clipboard!`, 'Invite Link');
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        toast.info(`Meeting code: ${roomCode}`, 'Room Code');
      });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (windowMode !== 'floating') return;
    if ((e.target as HTMLElement).closest('button')) return;

    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const winW = windowRef.current?.offsetWidth || 340;
    const winH = windowRef.current?.offsetHeight || 280;

    const nextX = Math.max(
      16,
      Math.min(window.innerWidth - winW - 16, dragStartRef.current.startX + deltaX),
    );
    const nextY = Math.max(
      16,
      Math.min(window.innerHeight - winH - 16, dragStartRef.current.startY + deltaY),
    );

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalParticipants = 1 + remoteReviewers.length + 1;

  if (windowMode === 'minimized') {
    return (
      <>
        <MeetingBubble
          roomCode={roomCode}
          totalParticipants={totalParticipants}
          isSpeaking={isSpeaking}
          isMuted={isMuted}
          onExpandFloating={() => setWindowMode('floating')}
          onExpandFullscreen={() => setWindowMode('fullscreen')}
          onOpenLeaveModal={() => setShowLeaveModal(true)}
        />
        <LeaveMeetingModal
          isOpen={showLeaveModal}
          roomCode={roomCode}
          onConfirmLeave={handleConfirmLeave}
          onCancel={() => setShowLeaveModal(false)}
        />
      </>
    );
  }

  if (windowMode === 'fullscreen') {
    return (
      <>
        <MeetingFullscreenStage
          roomCode={roomCode}
          elapsedSeconds={elapsedSeconds}
          copied={copied}
          onCopyLink={handleCopyLink}
          onExitFullscreen={() => setWindowMode('floating')}
          isScreenSharing={isScreenSharing}
          screenVideoRef={screenVideoRef}
          onToggleScreenShare={() => void toggleScreenShare()}
          isVideoOn={isVideoOn}
          localStream={localStream}
          selfVideoRef={selfVideoRef}
          isSpeaking={isSpeaking}
          isMuted={isMuted}
          audioLevel={audioLevel}
          currentUser={currentUser}
          aiRaisedHand={aiRaisedHand}
          isEvaluatingAi={isEvaluatingAi}
          onAskAiOpinion={onAskAiOpinion}
          hazardsCount={hazardsCount}
          onOpenSreFinding={onOpenSreFinding}
          remoteReviewers={remoteReviewers}
          activeSideDrawer={activeSideDrawer}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          isSendingChat={isEvaluatingAi}
          onCloseSideDrawer={() => setActiveSideDrawer('none')}
          onToggleSideDrawer={(drawer) =>
            setActiveSideDrawer((prev) => (prev === drawer ? 'none' : drawer))
          }
          onToggleAudio={toggleAudio}
          onToggleVideo={() => void toggleVideo()}
          onOpenLeaveModal={() => setShowLeaveModal(true)}
          formatTimer={formatTimer}
        />
        <LeaveMeetingModal
          isOpen={showLeaveModal}
          roomCode={roomCode}
          onConfirmLeave={handleConfirmLeave}
          onCancel={() => setShowLeaveModal(false)}
        />
      </>
    );
  }

  const floatingStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
      };

  return (
    <>
      <MeetingFloatingWindow
        windowRef={windowRef}
        floatingStyle={floatingStyle}
        roomCode={roomCode}
        elapsedSeconds={elapsedSeconds}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMinimize={() => setWindowMode('minimized')}
        onFullscreen={() => setWindowMode('fullscreen')}
        onOpenLeaveModal={() => setShowLeaveModal(true)}
        isSpeaking={isSpeaking}
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        localStream={localStream}
        selfVideoRef={selfVideoRef}
        currentUser={currentUser}
        aiRaisedHand={aiRaisedHand}
        isEvaluatingAi={isEvaluatingAi}
        onAskAiOpinion={onAskAiOpinion}
        onOpenSreFinding={onOpenSreFinding}
        remoteReviewers={remoteReviewers}
        copied={copied}
        onCopyLink={handleCopyLink}
        onToggleAudio={toggleAudio}
        onToggleVideo={() => void toggleVideo()}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={() => void toggleScreenShare()}
        formatTimer={formatTimer}
      />
      <LeaveMeetingModal
        isOpen={showLeaveModal}
        roomCode={roomCode}
        onConfirmLeave={handleConfirmLeave}
        onCancel={() => setShowLeaveModal(false)}
      />
    </>
  );
}
