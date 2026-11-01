import type React from 'react';
import type { RemoteReviewer } from '../useCollaborationPresence';
import { MeetingControlsDock } from './MeetingControlsDock';
import { MeetingSideDrawer } from './MeetingSideDrawer';

export interface MeetingFullscreenStageProps {
  readonly roomCode: string;
  readonly elapsedSeconds: number;
  readonly copied: boolean;
  readonly onCopyLink: () => void;
  readonly onExitFullscreen: () => void;
  readonly isScreenSharing: boolean;
  readonly screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  readonly onToggleScreenShare: () => void;
  readonly isVideoOn: boolean;
  readonly localStream: MediaStream | null;
  readonly selfVideoRef: React.RefObject<HTMLVideoElement | null>;
  readonly isSpeaking: boolean;
  readonly isMuted: boolean;
  readonly audioLevel: number;
  readonly currentUser: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly aiRaisedHand: boolean;
  readonly hazardsCount: number;
  readonly onOpenSreFinding: () => void;
  readonly remoteReviewers: readonly RemoteReviewer[];
  readonly activeSideDrawer: 'none' | 'people' | 'sre';
  readonly onCloseSideDrawer: () => void;
  readonly onToggleSideDrawer: (drawer: 'people' | 'sre') => void;
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
  readonly onOpenLeaveModal: () => void;
  readonly formatTimer: (totalSec: number) => string;
}

export function MeetingFullscreenStage({
  roomCode,
  elapsedSeconds,
  copied,
  onCopyLink,
  onExitFullscreen,
  isScreenSharing,
  screenVideoRef,
  onToggleScreenShare,
  isVideoOn,
  localStream,
  selfVideoRef,
  isSpeaking,
  isMuted,
  audioLevel,
  currentUser,
  aiRaisedHand,
  hazardsCount,
  onOpenSreFinding,
  remoteReviewers,
  activeSideDrawer,
  onCloseSideDrawer,
  onToggleSideDrawer,
  onToggleAudio,
  onToggleVideo,
  onOpenLeaveModal,
  formatTimer,
}: MeetingFullscreenStageProps) {
  return (
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
            onClick={onCopyLink}
            title="Copy meeting invite link"
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{copied ? 'Link Copied!' : 'Copy Invite'}</span>
          </button>
        </div>

        <div className="meet-fs-header-center">
          <div className="meet-fs-timer-badge">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>
          <div className="meet-fs-security-badge" title="End-to-end topology stream protected">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Encrypted Review</span>
          </div>
        </div>

        <div className="meet-fs-header-right">
          <button
            type="button"
            className="meet-fs-icon-btn"
            onClick={onExitFullscreen}
            title="Exit full screen to floating window (Esc)"
            aria-label="Exit full screen"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
            <span className="meet-btn-text">Float Window</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Video Stage + Side Drawer */}
      <div className="meet-fs-stage-container">
        <main className={`meet-fs-grid ${isScreenSharing ? 'has-screen-share' : ''}`}>
          {/* Screen Share Tile */}
          {isScreenSharing && (
            <div className="meet-tile meet-tile-screen">
              <video ref={screenVideoRef} autoPlay playsInline className="meet-screen-video" />
              <div className="meet-tile-badge screen">
                <span>You are presenting your screen</span>
                <button
                  type="button"
                  className="btn-stop-share-inline"
                  onClick={onToggleScreenShare}
                >
                  Stop Sharing
                </button>
              </div>
            </div>
          )}

          {/* Self Tile */}
          <div className={`meet-tile meet-tile-self ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
            {isVideoOn && localStream ? (
              <video ref={selfVideoRef} autoPlay playsInline muted className="meet-camera-video" />
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
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    </svg>
                  </span>
                ) : (
                  <span className="meet-mic-pill live" title="Microphone active">
                    <span
                      className="meet-live-audio-bar"
                      style={{ height: `${Math.max(4, (audioLevel / 100) * 14)}px` }}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta AI SRE Watcher Tile */}
          <div className="meet-tile meet-tile-ai">
            <div className="meet-avatar-wrap large ai">
              <svg
                viewBox="0 0 24 24"
                width="36"
                height="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              {aiRaisedHand && <span className="meet-ai-hazard-ping" />}
            </div>

            <div className="meet-ai-card-details">
              <span className="meet-ai-title">Meta AI SRE</span>
              <span className="meet-ai-desc">Autonomous Architecture Sentinel</span>

              {hazardsCount > 0 ? (
                <div
                  className="meet-hazard-alert-pill"
                  onClick={onOpenSreFinding}
                  role="button"
                  tabIndex={0}
                >
                  <span className="hazard-alert-dot" />
                  <span>
                    {hazardsCount} Architectural Risk{hazardsCount > 1 ? 's' : ''} Flagged &bull;
                    Review
                  </span>
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

          {/* Real Remote Reviewers */}
          {remoteReviewers.map((reviewer) => (
            <div
              key={reviewer.userId}
              className={`meet-tile meet-tile-peer ${reviewer.isSpeaking ? 'speaking' : ''}`}
            >
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

          {/* Clean Empty Collaborator Prompt */}
          {remoteReviewers.length === 0 && (
            <div className="meet-tile meet-tile-invite">
              <div className="meet-invite-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
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
              <button type="button" className="meet-copy-invite-action" onClick={onCopyLink}>
                {copied ? 'Code Copied!' : `Copy Room Link (${roomCode})`}
              </button>
            </div>
          )}
        </main>

        {/* Collapsible Right Side Drawer */}
        {activeSideDrawer !== 'none' && (
          <MeetingSideDrawer
            activeSideDrawer={activeSideDrawer}
            currentUser={currentUser}
            remoteReviewers={remoteReviewers}
            isMuted={isMuted}
            hazardsCount={hazardsCount}
            onClose={onCloseSideDrawer}
            onOpenSreFinding={onOpenSreFinding}
          />
        )}
      </div>

      {/* Center-Bottom Control Dock */}
      <MeetingControlsDock
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        isScreenSharing={isScreenSharing}
        aiRaisedHand={aiRaisedHand}
        activeSideDrawer={activeSideDrawer}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onOpenSreFinding={onOpenSreFinding}
        onToggleSideDrawer={onToggleSideDrawer}
        onMinimizeToFloat={onExitFullscreen}
        onOpenLeaveModal={onOpenLeaveModal}
      />
    </div>
  );
}
