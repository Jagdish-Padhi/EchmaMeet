import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../toast';
import { LeaveMeetingModal } from './LeaveMeetingModal';
import { useMeetingMediaStream } from './useMeetingMediaStream';
import type { RemoteReviewer } from './useCollaborationPresence';

export interface FloatingMeetingPiPProps {
  readonly isActive: boolean;
  readonly roomCode: string;
  readonly aiRaisedHand: boolean;
  readonly onOpenSreFinding: () => void;
  readonly onLeaveMeeting: () => void;
  readonly currentUser?: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly remoteReviewers?: readonly RemoteReviewer[];
  readonly hazardsCount?: number;
}

type WindowMode = 'minimized' | 'floating' | 'fullscreen';

export function FloatingMeetingPiP({
  isActive,
  roomCode,
  aiRaisedHand,
  onOpenSreFinding,
  onLeaveMeeting,
  currentUser = { name: 'Alex Chen', role: 'Staff SRE', avatar: 'AC' },
  remoteReviewers = [],
  hazardsCount = 0,
}: FloatingMeetingPiPProps) {
  const toast = useToast();
  const [windowMode, setWindowMode] = useState<WindowMode>('floating');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSideDrawer, setActiveSideDrawer] = useState<'none' | 'people' | 'sre'>('none');
  const [copied, setCopied] = useState(false);

  // Position state for floating window dragging
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const windowRef = useRef<HTMLDivElement>(null);

  // Real WebRTC Media Stream & Web Audio channelization
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
  } = useMeetingMediaStream({
    autoStart: isActive,
    onPermissionError: (msg) => {
      toast.warning(msg, 'Media Devices');
    },
  });

  // Self video element ref
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local video stream
  useEffect(() => {
    if (selfVideoRef.current) {
      if (localStream && isVideoOn) {
        selfVideoRef.current.srcObject = localStream;
      } else {
        selfVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isVideoOn, windowMode]);

  // Attach screen share stream
  useEffect(() => {
    if (screenVideoRef.current) {
      if (screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      } else {
        screenVideoRef.current.srcObject = null;
      }
    }
  }, [screenStream, windowMode]);

  // Elapsed timer
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Keyboard shortcut listener (Esc exits fullscreen, M mutes, V toggles video)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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

  // Drag handlers for floating window header
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

    const nextX = Math.max(16, Math.min(window.innerWidth - winW - 16, dragStartRef.current.startX + deltaX));
    const nextY = Math.max(16, Math.min(window.innerHeight - winH - 16, dragStartRef.current.startY + deltaY));

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

  const totalParticipants = 1 + (remoteReviewers.length) + 1; // You + real peers + AI SRE Watcher

  // ==========================================
  // 1. MINIMIZED STATE: Sleek floating bubble
  // ==========================================
  if (windowMode === 'minimized') {
    return (
      <>
        <aside
          className="meeting-pip-bubble"
          onClick={() => setWindowMode('floating')}
          role="button"
          tabIndex={0}
          aria-label="Expand Google Meet review window"
          title="Click to expand architecture review call"
        >
          <span className="pip-live-pulse" />
          <span className="pip-bubble-title">{roomCode || '#rfc-checkout-v2'}</span>

          {/* Real Audio Volume Wave Indicator in Bubble */}
          {isSpeaking && !isMuted ? (
            <span className="pip-audio-speaking-dot" title="Speaking..." />
          ) : isMuted ? (
            <span className="pip-bubble-muted-tag" title="Microphone muted">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              </svg>
            </span>
          ) : null}

          <span className="pip-badge-count">{totalParticipants}</span>

          {/* Quick Expand Button */}
          <button
            type="button"
            className="pip-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setWindowMode('floating');
            }}
            title="Expand to floating window"
            aria-label="Expand"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          {/* Quick Enlarge Fullscreen Button */}
          <button
            type="button"
            className="pip-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setWindowMode('fullscreen');
            }}
            title="Enlarge to full screen (Google Meet)"
            aria-label="Full screen"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>

          {/* Quick Leave Button */}
          <button
            type="button"
            className="pip-bubble-end-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowLeaveModal(true);
            }}
            title="End / Leave Call"
            aria-label="Leave call"
          >
            &times;
          </button>
        </aside>

        <LeaveMeetingModal
          isOpen={showLeaveModal}
          roomCode={roomCode}
          onConfirmLeave={handleConfirmLeave}
          onCancel={() => setShowLeaveModal(false)}
        />
      </>
    );
  }

  // ==============================================================
  // 2. FULLSCREEN STATE: Complete Google Meet Styled Experience
  // ==============================================================
  if (windowMode === 'fullscreen') {
    return (
      <>
        <div
          className="google-meet-fullscreen-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Google Meet Architecture Review Call"
        >
          {/* Top Bar: Room Title, Timer, Room Code, Controls */}
          <header className="meet-fs-header">
            <div className="meet-fs-header-left">
              <span className="pip-live-pulse" />
              <div className="meet-fs-title-wrap">
                <span className="meet-fs-room-title">Architecture Resilience Review</span>
                <span className="meet-fs-room-code cell-mono">{roomCode}</span>
              </div>
              <button
                type="button"
                className="meet-fs-copy-btn"
                onClick={handleCopyLink}
                title="Copy meeting invite link"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>{copied ? 'Link Copied!' : 'Copy Invite'}</span>
              </button>
            </div>

            <div className="meet-fs-header-center">
              <div className="meet-fs-timer-badge">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
              <div className="meet-fs-security-badge" title="End-to-end topology stream protected">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Encrypted Review</span>
              </div>
            </div>

            <div className="meet-fs-header-right">
              {/* Exit Fullscreen -> Floating Window */}
              <button
                type="button"
                className="meet-fs-icon-btn"
                onClick={() => setWindowMode('floating')}
                title="Exit full screen to floating window (Esc)"
                aria-label="Exit full screen"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span className="meet-btn-text">Float Window</span>
              </button>
            </div>
          </header>

          {/* Main Content Area: Video Stage + Side Drawer */}
          <div className="meet-fs-stage-container">
            <main className={`meet-fs-grid ${isScreenSharing ? 'has-screen-share' : ''}`}>
              {/* Screen Share Tile (takes prominent space if active) */}
              {isScreenSharing && (
                <div className="meet-tile meet-tile-screen">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    className="meet-screen-video"
                  />
                  <div className="meet-tile-badge screen">
                    <span>You are presenting your screen</span>
                    <button
                      type="button"
                      className="btn-stop-share-inline"
                      onClick={() => void toggleScreenShare()}
                    >
                      Stop Sharing
                    </button>
                  </div>
                </div>
              )}

              {/* Self Tile (Real Video Stream or Avatar with Audio Ripple) */}
              <div className={`meet-tile meet-tile-self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
                {isVideoOn && localStream ? (
                  <video
                    ref={selfVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="meet-camera-video"
                  />
                ) : (
                  <div className="meet-avatar-wrap large">
                    <span className="meet-avatar-initials">{currentUser.avatar}</span>
                    {isSpeaking && !isMuted && <span className="meet-speaking-ring" />}
                  </div>
                )}

                <div className="meet-tile-footer">
                  <div className="meet-tile-user-info">
                    <span className="meet-tile-name">{currentUser.name} (You)</span>
                    <span className="meet-tile-role">{currentUser.role}</span>
                  </div>
                  <div className="meet-tile-status-icons">
                    {isMuted ? (
                      <span className="meet-mic-pill muted" title="Microphone muted">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                        </svg>
                      </span>
                    ) : (
                      <span className="meet-mic-pill live" title="Microphone active">
                        <span className="meet-live-audio-bar" style={{ height: `${Math.max(4, (audioLevel / 100) * 14)}px` }} />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta AI SRE Watcher Tile */}
              <div className="meet-tile meet-tile-ai">
                <div className="meet-avatar-wrap large ai">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  {aiRaisedHand && <span className="meet-ai-hazard-ping" />}
                </div>

                <div className="meet-ai-card-details">
                  <span className="meet-ai-title">Meta AI SRE</span>
                  <span className="meet-ai-desc">Autonomous Architecture Sentinel</span>

                  {hazardsCount > 0 ? (
                    <div className="meet-hazard-alert-pill" onClick={onOpenSreFinding} role="button" tabIndex={0}>
                      <span className="hazard-alert-dot" />
                      <span>{hazardsCount} Architectural Risk{hazardsCount > 1 ? 's' : ''} Flagged &bull; Review</span>
                    </div>
                  ) : (
                    <div className="meet-hazard-clean-pill">
                      <span className="status-clean-dot" />
                      <span>Topology Resilient &bull; Live Watch</span>
                    </div>
                  )}
                </div>

                <div className="meet-tile-footer">
                  <span className="meet-tile-name ai">AI SRE Copilot</span>
                  <button
                    type="button"
                    className="meet-open-finding-btn"
                    onClick={onOpenSreFinding}
                    title="Open resilience analysis modal"
                  >
                    View Findings &rarr;
                  </button>
                </div>
              </div>

              {/* Real Remote Reviewers (if connected via WebSocket presence) */}
              {remoteReviewers.map((reviewer) => (
                <div key={reviewer.userId} className={`meet-tile meet-tile-peer ${reviewer.isSpeaking ? 'speaking' : ''}`}>
                  <div className="meet-avatar-wrap large peer">
                    <span className="meet-avatar-initials">{reviewer.avatar || 'SRE'}</span>
                  </div>
                  <div className="meet-tile-footer">
                    <div className="meet-tile-user-info">
                      <span className="meet-tile-name">{reviewer.name}</span>
                      <span className="meet-tile-role">{reviewer.role}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Clean Empty Collaborator Prompt (No Mock Data Noise!) */}
              {remoteReviewers.length === 0 && (
                <div className="meet-tile meet-tile-invite">
                  <div className="meet-invite-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </div>
                  <div className="meet-invite-title">Invite Team to Architecture Review</div>
                  <p className="meet-invite-desc">
                    Share your room code with engineers to collaborate in real-time.
                  </p>
                  <button
                    type="button"
                    className="meet-copy-invite-action"
                    onClick={handleCopyLink}
                  >
                    {copied ? 'Code Copied!' : `Copy Room Link (${roomCode})`}
                  </button>
                </div>
              )}
            </main>

            {/* Google Meet Collapsible Right Side Drawer */}
            {activeSideDrawer !== 'none' && (
              <aside className="meet-fs-side-drawer">
                <div className="meet-drawer-header">
                  <h3>{activeSideDrawer === 'people' ? 'People in Call' : 'SRE Analysis & Risks'}</h3>
                  <button
                    type="button"
                    className="meet-drawer-close"
                    onClick={() => setActiveSideDrawer('none')}
                  >
                    &times;
                  </button>
                </div>

                <div className="meet-drawer-body">
                  {activeSideDrawer === 'people' && (
                    <div className="meet-people-list">
                      <div className="meet-person-row">
                        <span className="person-avatar host">{currentUser.avatar}</span>
                        <div className="person-info">
                          <span className="person-name">{currentUser.name} (You)</span>
                          <span className="person-role">{currentUser.role} &bull; Host</span>
                        </div>
                        <span className="person-media-state">
                          {isMuted ? 'Muted' : 'Speaking'}
                        </span>
                      </div>

                      <div className="meet-person-row">
                        <span className="person-avatar ai">AI</span>
                        <div className="person-info">
                          <span className="person-name">Meta AI SRE</span>
                          <span className="person-role">Autonomous Sentinel</span>
                        </div>
                      </div>

                      {remoteReviewers.map((r) => (
                        <div key={r.userId} className="meet-person-row">
                          <span className="person-avatar">{r.avatar}</span>
                          <div className="person-info">
                            <span className="person-name">{r.name}</span>
                            <span className="person-role">{r.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeSideDrawer === 'sre' && (
                    <div className="meet-sre-findings-panel">
                      <div className="sre-findings-overview">
                        <span className="sre-count-tag">{hazardsCount} Issues</span>
                        <span>Continuous canvas resilience analysis active.</span>
                      </div>
                      <button
                        type="button"
                        className="btn-sre-full-modal"
                        onClick={onOpenSreFinding}
                      >
                        Launch Interactive SRE Findings Modal &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Google Meet Floating Center-Bottom Control Dock */}
          <footer className="meet-fs-controls-dock">
            <div className="meet-controls-cluster">
              {/* 1. Mic Button */}
              <button
                type="button"
                className={`meet-ctrl-btn ${isMuted ? 'muted' : 'active'}`}
                onClick={toggleAudio}
                title={isMuted ? 'Turn on microphone (m)' : 'Turn off microphone (m)'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* 2. Camera Button */}
              <button
                type="button"
                className={`meet-ctrl-btn ${!isVideoOn ? 'muted' : 'active'}`}
                onClick={() => void toggleVideo()}
                title={isVideoOn ? 'Turn off camera (v)' : 'Turn on camera (v)'}
                aria-label={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoOn ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                )}
              </button>

              {/* 3. Screen Share (Present Now) */}
              <button
                type="button"
                className={`meet-ctrl-btn ${isScreenSharing ? 'active-highlight' : ''}`}
                onClick={() => void toggleScreenShare()}
                title={isScreenSharing ? 'Stop presenting' : 'Present your screen'}
                aria-label="Present screen"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" />
                  <polyline points="8 21 12 17 16 21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <polygon points="17 2 22 2 22 7 19 4 15 8 13 6 17 2" />
                </svg>
              </button>

              {/* 4. Hand Raise / SRE Alert Trigger */}
              <button
                type="button"
                className={`meet-ctrl-btn ${aiRaisedHand ? 'alert-highlight' : ''}`}
                onClick={onOpenSreFinding}
                title="Review Meta AI SRE findings"
                aria-label="SRE Findings"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                  <path d="M14 10V4a2 2 0 0 0-4 0v7" />
                  <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                  <path d="M6 14v-1a2 2 0 0 0-4 0v6a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0" />
                </svg>
              </button>

              <div className="meet-ctrl-divider" />

              {/* 5. People Drawer */}
              <button
                type="button"
                className={`meet-ctrl-btn ${activeSideDrawer === 'people' ? 'selected' : ''}`}
                onClick={() => setActiveSideDrawer((prev) => (prev === 'people' ? 'none' : 'people'))}
                title="Show everyone in call"
                aria-label="Participants"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>

              {/* 6. SRE Findings Drawer */}
              <button
                type="button"
                className={`meet-ctrl-btn ${activeSideDrawer === 'sre' ? 'selected' : ''}`}
                onClick={() => setActiveSideDrawer((prev) => (prev === 'sre' ? 'none' : 'sre'))}
                title="Show architectural findings"
                aria-label="Findings drawer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              {/* 7. Exit Fullscreen to Float */}
              <button
                type="button"
                className="meet-ctrl-btn"
                onClick={() => setWindowMode('floating')}
                title="Minimize back to float window"
                aria-label="Exit fullscreen"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>

              {/* 8. Call End Button (Red Phone Icon) -> Opens Confirmation Modal */}
              <button
                type="button"
                className="meet-ctrl-btn end-call"
                onClick={() => setShowLeaveModal(true)}
                title="Leave call"
                aria-label="End call"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
            </div>
          </footer>
        </div>

        <LeaveMeetingModal
          isOpen={showLeaveModal}
          roomCode={roomCode}
          onConfirmLeave={handleConfirmLeave}
          onCancel={() => setShowLeaveModal(false)}
        />
      </>
    );
  }

  // ==============================================================
  // 3. FLOATING STATE: Floatable / Draggable Windowed Mode
  // ==============================================================
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
      <aside
        ref={windowRef}
        className="meeting-pip-window"
        style={floatingStyle}
        aria-label="Active Google Meet Architecture Review Window"
        role="region"
      >
        {/* Draggable Window Titlebar */}
        <div
          className="pip-window-header draggable"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          title="Drag to reposition window"
        >
          <div className="pip-header-left">
            <span className="pip-live-pulse" />
            <span className="pip-window-title">{roomCode || '#rfc-checkout-v2'}</span>
            <span className="pip-timer-tag cell-mono">{formatTimer(elapsedSeconds)}</span>
          </div>

          <div className="pip-header-controls">
            {/* Minimize button */}
            <button
              type="button"
              className="pip-control-icon-btn"
              onClick={() => setWindowMode('minimized')}
              title="Minimize to floating pill"
              aria-label="Minimize"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Enlarge / Full Screen Google Meet button */}
            <button
              type="button"
              className="pip-control-icon-btn"
              onClick={() => setWindowMode('fullscreen')}
              title="Enlarge to full screen (Google Meet)"
              aria-label="Enlarge to full screen"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            {/* Close / End Call button */}
            <button
              type="button"
              className="pip-control-icon-btn danger"
              onClick={() => setShowLeaveModal(true)}
              title="Leave call"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Video Grid */}
        <div className="pip-video-grid">
          {/* Self Tile (Real Video Stream or Initials) */}
          <div className={`pip-tile tile-self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
            {isVideoOn && localStream ? (
              <video
                ref={selfVideoRef}
                autoPlay
                playsInline
                muted
                className="pip-camera-video"
              />
            ) : (
              <div className={`pip-avatar-wrap self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
                <span className="pip-avatar-text">{currentUser.avatar}</span>
              </div>
            )}

            <div className="pip-tile-meta">
              <span className="pip-tile-name">{currentUser.name} (You)</span>
              {isMuted ? (
                <span className="pip-mic-muted-icon" title="Microphone muted">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                  </svg>
                </span>
              ) : isSpeaking ? (
                <span className="pip-speaking-bars" aria-hidden="true">
                  <span className="bar" />
                  <span className="bar" />
                  <span className="bar" />
                </span>
              ) : null}
            </div>
          </div>

          {/* Meta AI SRE Watcher Tile */}
          <div className="pip-tile tile-ai" onClick={onOpenSreFinding} role="button" tabIndex={0} title="Click to view AI SRE findings">
            <div className="pip-avatar-wrap ai-pulse">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div className="pip-tile-meta">
              <span className="pip-tile-name ai">Meta AI SRE</span>
              {aiRaisedHand && <span className="pip-alert-dot" title="Risk identified" />}
            </div>
          </div>

          {/* Real Remote Reviewer Tile if connected (NO MOCK NOISE) */}
          {remoteReviewers.length > 0 ? (
            remoteReviewers.slice(0, 1).map((peer) => (
              <div key={peer.userId} className="pip-tile tile-peer">
                <div className="pip-avatar-wrap">
                  <span className="pip-avatar-text">{peer.avatar || 'SRE'}</span>
                </div>
                <div className="pip-tile-meta">
                  <span className="pip-tile-name">{peer.name}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="pip-tile tile-invite" onClick={handleCopyLink} role="button" tabIndex={0} title="Click to copy invite link">
              <span className="pip-invite-text">{copied ? 'Copied!' : '+ Invite'}</span>
            </div>
          )}
        </div>

        {/* Floating Google Meet Bottom Control Bar */}
        <div className="pip-controls-bar">
          {/* Mic Toggle */}
          <button
            type="button"
            className={`pip-action-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleAudio}
            title={isMuted ? 'Unmute microphone (m)' : 'Mute microphone (m)'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Cam Toggle */}
          <button
            type="button"
            className={`pip-action-btn ${!isVideoOn ? 'muted' : ''}`}
            onClick={() => void toggleVideo()}
            title={isVideoOn ? 'Turn camera off (v)' : 'Turn camera on (v)'}
            aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {isVideoOn ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            )}
          </button>

          {/* Screen Share Button */}
          <button
            type="button"
            className={`pip-action-btn ${isScreenSharing ? 'highlight' : ''}`}
            onClick={() => void toggleScreenShare()}
            title={isScreenSharing ? 'Stop screen sharing' : 'Present your screen'}
            aria-label="Present screen"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" />
              <polyline points="8 21 12 17 16 21" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <polygon points="17 2 22 2 22 7 19 4 15 8 13 6 17 2" />
            </svg>
          </button>

          {/* Hand Raise / AI Finding Trigger */}
          <button
            type="button"
            className={`pip-action-btn ${aiRaisedHand ? 'highlight' : ''}`}
            onClick={onOpenSreFinding}
            title="Review Meta AI SRE analysis findings"
            aria-label="Review findings"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 11V6a2 2 0 0 0-4 0v5" />
              <path d="M14 10V4a2 2 0 0 0-4 0v7" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M6 14v-1a2 2 0 0 0-4 0v6a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0" />
            </svg>
          </button>

          {/* Enlarge / Full Screen Button */}
          <button
            type="button"
            className="pip-action-btn"
            onClick={() => setWindowMode('fullscreen')}
            title="Enlarge to full screen (Google Meet)"
            aria-label="Full screen"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>

          {/* Red Leave Call Phone Button -> Opens Confirmation Modal */}
          <button
            type="button"
            className="pip-action-btn end-call"
            onClick={() => setShowLeaveModal(true)}
            title="Leave architecture review call"
            aria-label="Leave call"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Leave Call Confirmation Modal */}
      <LeaveMeetingModal
        isOpen={showLeaveModal}
        roomCode={roomCode}
        onConfirmLeave={handleConfirmLeave}
        onCancel={() => setShowLeaveModal(false)}
      />
    </>
  );
}
