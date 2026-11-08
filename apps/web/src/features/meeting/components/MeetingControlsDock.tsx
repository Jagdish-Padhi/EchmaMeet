import { FemaleArchitectIcon } from '../../../components/ui/FemaleArchitectIcon';

export interface MeetingControlsDockProps {
  readonly isMuted: boolean;
  readonly isVideoOn: boolean;
  readonly isScreenSharing: boolean;
  readonly aiRaisedHand: boolean;
  readonly isEvaluatingAi?: boolean | undefined;
  readonly onAskAiOpinion?: (() => void) | undefined;
  readonly isCaptionsActive?: boolean | undefined;
  readonly onToggleCaptions?: (() => void) | undefined;
  readonly activeSideDrawer: 'none' | 'people' | 'chat';
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
  readonly onToggleScreenShare: () => void;
  readonly onOpenSreFinding?: (() => void) | undefined;
  readonly onToggleSideDrawer: (drawer: 'people' | 'chat') => void;
  readonly onOpenLeaveModal: () => void;
}

export function MeetingControlsDock({
  isMuted,
  isVideoOn,
  isScreenSharing,
  isEvaluatingAi,
  onAskAiOpinion,
  isCaptionsActive,
  onToggleCaptions,
  activeSideDrawer,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSideDrawer,
  onOpenLeaveModal,
}: MeetingControlsDockProps) {
  return (
    <footer className="meet-fs-controls-dock">
      <div className="meet-controls-cluster">
        {/* 1. Mic Button */}
        <button
          type="button"
          className={`meet-ctrl-btn ${isMuted ? 'muted' : 'active'}`}
          onClick={onToggleAudio}
          title={isMuted ? 'Turn on microphone (m)' : 'Turn off microphone (m)'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
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
              width="18"
              height="18"
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

        {/* 2. Camera Button */}
        <button
          type="button"
          className={`meet-ctrl-btn ${!isVideoOn ? 'muted' : 'active'}`}
          onClick={onToggleVideo}
          title={isVideoOn ? 'Turn off camera (v)' : 'Turn on camera (v)'}
          aria-label={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoOn ? (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
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
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
        </button>

        {/* 3. Screen Share (Present Now) */}
        <button
          type="button"
          className={`meet-ctrl-btn ${isScreenSharing ? 'active-highlight' : ''}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop presenting' : 'Present your screen'}
          aria-label="Present screen"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
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

        {/* 4. Ask Echma Trigger */}
        {onAskAiOpinion && (
          <button
            type="button"
            className={`meet-ctrl-btn ask-echma-btn ${isEvaluatingAi ? 'active-highlight' : ''}`}
            onClick={onAskAiOpinion}
            title="Ask Echma for live architecture opinion"
            aria-label="Ask Echma"
          >
            <span className="ask-echma-label">
              <FemaleArchitectIcon size={16} strokeWidth={2} />
              <span>{isEvaluatingAi ? 'Analyzing...' : 'Ask Echma'}</span>
            </span>
          </button>
        )}

        {/* 5. Live Captions / STT Toggle (Token Saver) */}
        {onToggleCaptions && (
          <button
            type="button"
            className={`meet-ctrl-btn ${isCaptionsActive ? 'active' : 'muted'}`}
            onClick={onToggleCaptions}
            title={
              isCaptionsActive
                ? 'Turn off live captions (Saves Gnani Prisma tokens)'
                : 'Turn on live captions (Gnani Prisma STT)'
            }
            aria-label="Live Captions"
            style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}
          >
            CC
          </button>
        )}

        <div className="meet-ctrl-divider" />

        {/* 5. People Drawer */}
        <button
          type="button"
          className={`meet-ctrl-btn ${activeSideDrawer === 'people' ? 'selected' : ''}`}
          onClick={() => onToggleSideDrawer('people')}
          title="Show everyone in call"
          aria-label="Participants"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        {/* 6. In-call Chat Drawer */}
        <button
          type="button"
          className={`meet-ctrl-btn ${activeSideDrawer === 'chat' ? 'selected' : ''}`}
          onClick={() => onToggleSideDrawer('chat')}
          title="Chat with everyone and Echma"
          aria-label="In-call chat"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* 7. Call End Button */}
        <button
          type="button"
          className="meet-ctrl-btn end-call"
          onClick={onOpenLeaveModal}
          title="Leave call"
          aria-label="End call"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
