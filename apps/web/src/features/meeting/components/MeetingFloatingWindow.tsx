import type React from 'react';
import type { RemoteReviewer } from '../useCollaborationPresence';
import { FemaleArchitectIcon } from '../../../components/ui/FemaleArchitectIcon';

export interface MeetingFloatingWindowProps {
  readonly windowRef: React.RefObject<HTMLDivElement | null>;
  readonly floatingStyle: React.CSSProperties;
  readonly roomCode: string;
  readonly elapsedSeconds: number;
  readonly onPointerDown: (e: React.PointerEvent) => void;
  readonly onPointerMove: (e: React.PointerEvent) => void;
  readonly onPointerUp: (e: React.PointerEvent) => void;
  readonly onMinimize: () => void;
  readonly onFullscreen: () => void;
  readonly onOpenLeaveModal: () => void;
  readonly isSpeaking: boolean;
  readonly isMuted: boolean;
  readonly isVideoOn: boolean;
  readonly localStream: MediaStream | null;
  readonly selfVideoRef: React.RefObject<HTMLVideoElement | null>;
  readonly currentUser: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly aiRaisedHand: boolean;
  readonly isEvaluatingAi?: boolean | undefined;
  readonly onAskAiOpinion?: (() => void) | undefined;
  readonly isCaptionsActive?: boolean | undefined;
  readonly onToggleCaptions?: (() => void) | undefined;
  readonly onOpenSreFinding: () => void;
  readonly remoteReviewers: readonly RemoteReviewer[];
  readonly copied: boolean;
  readonly onCopyLink: () => void;
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
  readonly isScreenSharing: boolean;
  readonly onToggleScreenShare: () => void;
  readonly formatTimer: (totalSec: number) => string;
  readonly onAutoRemediate?: (() => void) | undefined;
}

export function MeetingFloatingWindow({
  windowRef,
  floatingStyle,
  roomCode,
  elapsedSeconds,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onMinimize,
  onFullscreen,
  onOpenLeaveModal,
  isSpeaking,
  isMuted,
  isVideoOn,
  localStream,
  selfVideoRef,
  currentUser,
  aiRaisedHand,
  isEvaluatingAi,
  onAskAiOpinion,
  isCaptionsActive,
  onToggleCaptions,
  onOpenSreFinding,
  remoteReviewers,
  copied,
  onCopyLink,
  onToggleAudio,
  onToggleVideo,
  isScreenSharing,
  onToggleScreenShare,
  formatTimer,
  onAutoRemediate,
}: MeetingFloatingWindowProps) {
  return (
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to reposition window"
      >
        <div className="pip-header-left">
          <span className="pip-live-pulse" />
          <span className="pip-window-title">{roomCode || '#rfc-checkout-v2'}</span>
          <span className="pip-timer-tag cell-mono">{formatTimer(elapsedSeconds)}</span>
        </div>

        <div className="pip-header-controls">
          <button
            type="button"
            className="pip-control-icon-btn"
            onClick={onFullscreen}
            title="Enlarge to full screen (Google Meet)"
            aria-label="Enlarge to full screen"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          <button
            type="button"
            className="pip-control-icon-btn"
            onClick={onMinimize}
            title="Minimize to floating pill"
            aria-label="Minimize"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dynamic Video Grid */}
      <div className="pip-video-grid">
        {/* Self Tile */}
        <div className={`pip-tile tile-self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
          {isVideoOn && localStream ? (
            <video ref={selfVideoRef} autoPlay playsInline muted className="pip-camera-video" />
          ) : (
            <div className={`pip-avatar-wrap self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
              <span className="pip-avatar-text">{currentUser.avatar}</span>
            </div>
          )}

          <div className="pip-tile-meta">
            <span className="pip-tile-name">{currentUser.name} (You)</span>
            {isMuted ? (
              <span className="pip-mic-muted-icon" title="Microphone muted">
                <svg
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                >
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

        {/* Echma Watcher Tile */}
        <div
          className="pip-tile tile-ai"
          onClick={onOpenSreFinding}
          role="button"
          tabIndex={0}
          title="Click to view Echma findings"
          style={{ position: 'relative' }}
        >
          <div className="pip-avatar-wrap ai-pulse">
            <FemaleArchitectIcon size={18} strokeWidth={2} />
          </div>
          <div className="pip-tile-meta">
            <span className="pip-tile-name ai">Echma</span>
            {aiRaisedHand && <span className="pip-alert-dot" title="Risk identified" />}
          </div>
          {aiRaisedHand && onAutoRemediate && (
            <button
              type="button"
              className="pip-quick-heal-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAutoRemediate();
              }}
              title="Click to auto-remediate architecture hazard immediately"
              style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '9px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                zIndex: 5,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Remediate
            </button>
          )}
        </div>

        {/* Real Remote Reviewer Tile */}
        {remoteReviewers.length > 0 ? (
          remoteReviewers.slice(0, 1).map((peer) => (
            <div key={peer.userId} className="pip-tile tile-peer">
              {peer.stream ? (
                <video
                  ref={(el) => {
                    if (el && peer.stream && el.srcObject !== peer.stream) {
                      el.srcObject = peer.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  className="pip-camera-video"
                />
              ) : (
                <div className="pip-avatar-wrap">
                  <span className="pip-avatar-text">{peer.avatar || 'SRE'}</span>
                </div>
              )}
              <div className="pip-tile-meta">
                <span className="pip-tile-name">{peer.name}</span>
              </div>
            </div>
          ))
        ) : (
          <div
            className="pip-tile tile-invite"
            onClick={onCopyLink}
            role="button"
            tabIndex={0}
            title="Click to copy invite link"
          >
            <span className="pip-invite-text">{copied ? 'Copied!' : '+ Invite'}</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="pip-controls-bar">
        <button
          type="button"
          className={`pip-action-btn ${isMuted ? 'muted' : ''}`}
          onClick={onToggleAudio}
          title={isMuted ? 'Unmute microphone (m)' : 'Mute microphone (m)'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`pip-action-btn ${!isVideoOn ? 'muted' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOn ? 'Turn camera off (v)' : 'Turn camera on (v)'}
          aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isVideoOn ? (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`pip-action-btn ${isScreenSharing ? 'highlight' : ''}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop screen sharing' : 'Present your screen'}
          aria-label="Present screen"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" />
            <polyline points="8 21 12 17 16 21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <polygon points="17 2 22 2 22 7 19 4 15 8 13 6 17 2" />
          </svg>
        </button>

        <button
          type="button"
          className={`pip-action-btn ${aiRaisedHand ? 'highlight' : ''}`}
          onClick={onOpenSreFinding}
          title="Review Echma analysis findings"
          aria-label="Review findings"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10V4a2 2 0 0 0-4 0v7" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M6 14v-1a2 2 0 0 0-4 0v6a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0" />
          </svg>
        </button>

        {onAskAiOpinion && (
          <button
            type="button"
            className={`pip-action-btn pip-ask-echma-btn ${isEvaluatingAi ? 'highlight' : ''}`}
            onClick={onAskAiOpinion}
            title="Ask Echma for live architecture opinion"
            aria-label="Ask Echma"
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 4px',
              }}
            >
              <FemaleArchitectIcon size={14} strokeWidth={2} />
              <span>{isEvaluatingAi ? '...' : 'Ask Echma'}</span>
            </span>
          </button>
        )}

        {onToggleCaptions && (
          <button
            type="button"
            className={`pip-action-btn ${isCaptionsActive ? 'highlight' : ''}`}
            onClick={onToggleCaptions}
            title={
              isCaptionsActive
                ? 'Turn off live captions (Saves Gnani Prisma tokens)'
                : 'Turn on live captions (Gnani Prisma STT)'
            }
            aria-label="Live Captions"
            style={{ fontWeight: 700, fontSize: '10px' }}
          >
            CC
          </button>
        )}

        <button
          type="button"
          className="pip-action-btn end-call"
          onClick={onOpenLeaveModal}
          title="Leave architecture review call"
          aria-label="Leave call"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
