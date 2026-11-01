import { useState } from 'react';
import type { NodeKind, Topology } from '@chaosboard/contracts';
import { Button } from '../../components/ui/Button';
import { MeetingsDropdown } from '../../features/meeting';
import type { RemoteReviewer } from '../../features/meeting/useCollaborationPresence';
import {
  AnalysisDropdown,
  ImportDropdown,
  UserProfileMenu,
  type BoardState,
  type UserProfile,
} from '../../features/board';
import { ExportDropdown } from '../../features/repair';
import type { AppSettings } from '../../features/settings';

export type StudioDrawerTab =
  | 'none'
  | 'inspect'
  | 'chaos'
  | 'telemetry'
  | 'repair'
  | 'voice'
  | 'vision'
  | 'reports'
  | 'benchmarks'
  | 'runs';

export interface StudioNavbarProps {
  readonly board: BoardState;
  readonly activeDrawer: StudioDrawerTab;
  readonly setActiveDrawer: (tab: StudioDrawerTab) => void;
  readonly setView: (v: 'landing' | 'studio' | 'settings') => void;
  readonly addNode: (kind: NodeKind, preset?: Record<string, unknown>) => void;
  readonly duplicateSelected: () => void;
  readonly deleteSelected: () => void;
  readonly isMeetingLive: boolean;
  readonly meetingRoomCode: string;
  readonly currentReviewer: UserProfile;
  readonly remoteReviewers: readonly RemoteReviewer[];
  readonly setIsCreateMeetingOpen: (v: boolean) => void;
  readonly setIsJoinMeetingOpen: (v: boolean) => void;
  readonly setIsMeetingLive: (v: boolean) => void;
  readonly experimentSession: any;
  readonly canStartExperiment: boolean;
  readonly currentTopology: Topology;
  readonly scenariosState: any;
  readonly loadTopology: (t: Topology) => void;
  readonly setIsImportModalOpen: (v: boolean) => void;
  readonly setIsIacModalOpen: (v: boolean) => void;
  readonly handleExportRfc: () => void;
  readonly settings: AppSettings;
  readonly handleToggleTheme: () => void;
  readonly handleOpenSettings: () => void;
  readonly handleSignOut: () => void;
  readonly onToastInfo: (msg: string, title?: string) => void;
  readonly onToastSuccess: (msg: string, title?: string) => void;
  readonly onToastWarning: (msg: string, title?: string) => void;
}

export function StudioNavbar({
  board,
  activeDrawer,
  setActiveDrawer,
  setView,
  addNode,
  duplicateSelected,
  deleteSelected,
  isMeetingLive,
  meetingRoomCode,
  currentReviewer,
  remoteReviewers,
  setIsCreateMeetingOpen,
  setIsJoinMeetingOpen,
  setIsMeetingLive,
  experimentSession,
  canStartExperiment,
  currentTopology,
  scenariosState,
  loadTopology,
  setIsImportModalOpen,
  setIsIacModalOpen,
  handleExportRfc,
  settings,
  handleToggleTheme,
  handleOpenSettings,
  handleSignOut,
  onToastInfo,
  onToastSuccess,
  onToastWarning,
}: StudioNavbarProps) {
  const [isMorePrimitivesOpen, setIsMorePrimitivesOpen] = useState(false);

  return (
    <header className="studio-topbar">
      {/* Left: Brand Logo */}
      <div className="navbar-brand-section">
        <button
          type="button"
          className="navbar-brand-btn"
          onClick={() => setView('landing')}
          title="ChaosBoard Distributed Architecture Studio"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" fill="#0082fb" />
            <path d="M12 2v7m0 6v7M2 12h7m6 0h7" stroke="#0082fb" />
            <circle cx="12" cy="2" r="1.5" fill="#38bdf8" />
            <circle cx="12" cy="22" r="1.5" fill="#38bdf8" />
            <circle cx="2" cy="12" r="1.5" fill="#38bdf8" />
            <circle cx="22" cy="12" r="1.5" fill="#38bdf8" />
          </svg>
        </button>
      </div>

      {/* Center: Architecture Primitives Shelf */}
      <div className="navbar-center-shelf" role="toolbar" aria-label="Architecture Primitives">
        <div className="navbar-primitives-group">
          <button
            type="button"
            className="navbar-prim-btn"
            onClick={() =>
              addNode('service', { label: 'Microservice', processingMs: 15, maxWorkers: 15 })
            }
            title="Add Stateless Microservice (Key: 1)"
          >
            <span className="palette-dot blue" />
            <span>+ Service</span>
          </button>
          <button
            type="button"
            className="navbar-prim-btn"
            onClick={() =>
              addNode('service', { label: 'API Gateway', processingMs: 5, maxWorkers: 20 })
            }
            title="Add Ingress API Gateway"
          >
            <span className="palette-dot blue" />
            <span>+ Gateway</span>
          </button>
          <button
            type="button"
            className="navbar-prim-btn"
            onClick={() =>
              addNode('cache', {
                label: 'Redis Cache',
                processingMs: 2,
                maxWorkers: 25,
                ttlMs: 60000,
              })
            }
            title="Add Redis In-Memory Cache (Key: 2)"
          >
            <span className="palette-dot yellow" />
            <span>+ Cache</span>
          </button>
          <button
            type="button"
            className="navbar-prim-btn"
            onClick={() =>
              addNode('queue_consumer', {
                label: 'Kafka Stream',
                processingMs: 10,
                maxWorkers: 30,
                consumeRateRps: 100,
              })
            }
            title="Add Kafka / Queue Consumer (Key: 3)"
          >
            <span className="palette-dot cyan" />
            <span>+ Queue</span>
          </button>
          <button
            type="button"
            className="navbar-prim-btn"
            onClick={() =>
              addNode('service', { label: 'Postgres DB', processingMs: 35, maxWorkers: 5 })
            }
            title="Add Stateful Database Store"
          >
            <span className="palette-dot blue" />
            <span>+ DB</span>
          </button>

          {/* Specialized Presets Popover Dropdown */}
          <div className="navbar-dropdown-relative">
            <button
              type="button"
              className={`navbar-prim-btn more ${isMorePrimitivesOpen ? 'active' : ''}`}
              onClick={() => setIsMorePrimitivesOpen((v) => !v)}
              title="More architecture components"
            >
              <span>+ More</span>
              <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {isMorePrimitivesOpen && (
              <div className="navbar-more-menu" onMouseLeave={() => setIsMorePrimitivesOpen(false)}>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'Auth Service',
                      processingMs: 10,
                      maxWorkers: 10,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <span className="palette-dot blue" />
                  <span>Auth Service (OAuth/JWT)</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'External API',
                      processingMs: 85,
                      maxWorkers: 5,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <span className="palette-dot amber" />
                  <span>3rd-Party External API</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('cache', {
                      label: 'CDN Edge',
                      processingMs: 1,
                      maxWorkers: 50,
                      ttlMs: 300000,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <span className="palette-dot yellow" />
                  <span>CDN Edge (Cloudflare/Fastly)</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('ledger_sink', {
                      label: 'Financial Ledger',
                      processingMs: 50,
                      maxWorkers: 5,
                      dedupeByKey: true,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <span className="palette-dot green" />
                  <span>Ledger Sink (Idempotent: Key 4)</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('ledger_sink', {
                      label: 'Object Store',
                      processingMs: 35,
                      maxWorkers: 10,
                      dedupeByKey: false,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <span className="palette-dot green" />
                  <span>S3 / Object Store Sink</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="navbar-shelf-divider" />

        {/* Quick Duplicate & Delete Actions */}
        <div className="navbar-actions-group">
          <button
            type="button"
            className="navbar-action-btn"
            disabled={
              !board.selectedNodeId &&
              (!board.selectedNodeIds || board.selectedNodeIds.length === 0)
            }
            onClick={duplicateSelected}
            title="Duplicate selected element(s) (Cmd+D)"
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            className="navbar-action-btn danger"
            disabled={
              !board.selectedNodeId &&
              (!board.selectedNodeIds || board.selectedNodeIds.length === 0) &&
              !board.selectedEdgeId
            }
            onClick={() => {
              deleteSelected();
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            title="Delete selected element(s) (Del / Backspace)"
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Right: Operational Actions */}
      <div className="studio-topbar-actions">
        <MeetingsDropdown
          isMeetingActive={isMeetingLive}
          roomCode={meetingRoomCode}
          onOpenCreate={() => setIsCreateMeetingOpen(true)}
          onOpenJoin={() => setIsJoinMeetingOpen(true)}
          onLeaveMeeting={() => {
            setIsMeetingLive(false);
            onToastInfo('You have left the meeting.', 'Session Ended');
          }}
          onShareRoom={() => {
            const url = window.location.href;
            void navigator.clipboard.writeText(url);
            onToastSuccess('Meeting link copied to clipboard!', 'Share Meeting');
          }}
          currentUser={currentReviewer}
          remoteReviewers={remoteReviewers}
          onFocusMeeting={() => setIsMeetingLive(true)}
        />

        {experimentSession.status === 'running' || experimentSession.status === 'starting' ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onToastInfo('Stopping simulation...', 'Simulation');
              void experimentSession.cancelExperiment();
            }}
            title="Halt active resilience simulation"
          >
            Cancel Simulation
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className={!canStartExperiment ? 'btn-simulation-blocked' : ''}
            onClick={() => {
              setActiveDrawer('telemetry');
              if (!canStartExperiment) {
                onToastWarning(
                  board.nodes.length === 0
                    ? 'Add at least one service to canvas first.'
                    : `Architecture has ${String(board.validationProblems.length)} issue(s). Check the panel to resolve them.`,
                  'Cannot Simulate',
                );
                return;
              }
              void experimentSession.startExperiment(currentTopology);
            }}
            title={
              !canStartExperiment
                ? board.nodes.length === 0
                  ? 'Add at least one service to canvas to simulate'
                  : `Cannot simulate: ${String(board.validationProblems.length)} architecture issue(s) detected`
                : 'Run real-time resilience simulation (5s)'
            }
          >
            Run Simulation
          </Button>
        )}

        <AnalysisDropdown activeTab={activeDrawer} onSelectTab={setActiveDrawer} />

        <ImportDropdown
          onImportDiagram={() => setIsImportModalOpen(true)}
          onScanWhiteboard={() => setActiveDrawer('vision')}
          scenarios={scenariosState.scenarios}
          onSelectScenario={(sc) => {
            scenariosState.selectScenario(sc.id);
            loadTopology(sc.topology);
            const fault = sc.faults[0];
            if (fault) experimentSession.startExperiment(sc.topology);
          }}
        />

        <ExportDropdown onExportIac={() => setIsIacModalOpen(true)} onExportRfc={handleExportRfc} />

        <div className="studio-topbar-divider" />

        <button
          type="button"
          className="btn-icon-toggle"
          onClick={handleToggleTheme}
          title={`Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          aria-label="Toggle visual theme"
        >
          {settings.theme === 'dark' ? (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <UserProfileMenu
          user={currentReviewer}
          onOpenSettings={handleOpenSettings}
          onSignOut={handleSignOut}
        />
      </div>
    </header>
  );
}
