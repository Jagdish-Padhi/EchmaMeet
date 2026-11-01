import type { RemoteReviewer } from '../useCollaborationPresence';

export interface MeetingSideDrawerProps {
  readonly activeSideDrawer: 'people' | 'sre';
  readonly currentUser: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly remoteReviewers: readonly RemoteReviewer[];
  readonly isMuted: boolean;
  readonly hazardsCount: number;
  readonly onClose: () => void;
  readonly onOpenSreFinding: () => void;
}

export function MeetingSideDrawer({
  activeSideDrawer,
  currentUser,
  remoteReviewers,
  isMuted,
  hazardsCount,
  onClose,
  onOpenSreFinding,
}: MeetingSideDrawerProps) {
  return (
    <aside className="meet-fs-side-drawer">
      <div className="meet-drawer-header">
        <h3>{activeSideDrawer === 'people' ? 'People in Call' : 'SRE Analysis & Risks'}</h3>
        <button
          type="button"
          className="meet-drawer-close"
          onClick={onClose}
          aria-label="Close drawer"
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
              <span className="person-media-state">{isMuted ? 'Muted' : 'Speaking'}</span>
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
            <button type="button" className="btn-sre-full-modal" onClick={onOpenSreFinding}>
              Launch Interactive SRE Findings Modal &rarr;
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
