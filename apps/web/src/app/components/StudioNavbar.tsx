import { useState } from 'react';
import type { NodeKind, Topology } from '@chaosboard/contracts';
import { Button } from '../../components/ui/Button';
import { EchmaLogo } from '../../components/ui/EchmaLogo';
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
  readonly onLeaveMeeting?: (() => void) | undefined;
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
  readonly onToastError?: ((msg: string, title?: string) => void) | undefined;
  readonly onOpenPreflightBlocker?: (() => void) | undefined;
  readonly onOpenDiagnostics?: (() => void) | undefined;
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
  onLeaveMeeting,
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
  onOpenPreflightBlocker,
  onOpenDiagnostics,
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
          title="EchmaMeet Architecture Review & Resilience Studio"
        >
          <EchmaLogo size={26} />
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
            <span className="palette-dot cyan" />
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
            <span className="palette-dot blue" />
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
                {/* 1. Ingress & Gateways */}
                <div className="navbar-more-group-header">Ingress &amp; Routing</div>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'API Gateway (Envoy)',
                      processingMs: 3,
                      maxWorkers: 60,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot cyan" />
                    <span className="navbar-more-item-title">API Gateway (Envoy / Kong)</span>
                  </div>
                  <span className="navbar-more-item-meta">3ms · 60w</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'BFF GraphQL Gateway',
                      processingMs: 12,
                      maxWorkers: 35,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot cyan" />
                    <span className="navbar-more-item-title">BFF / GraphQL Gateway</span>
                  </div>
                  <span className="navbar-more-item-meta">12ms · 35w</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('cache', {
                      label: 'CDN / WAF Edge',
                      processingMs: 1,
                      maxWorkers: 100,
                      ttlMs: 300000,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot cyan" />
                    <span className="navbar-more-item-title">CDN / WAF Edge (Cloudflare)</span>
                  </div>
                  <span className="navbar-more-item-meta">1ms · 300s TTL</span>
                </button>

                <div className="navbar-more-divider" />

                {/* 2. Microservices & Integrations */}
                <div className="navbar-more-group-header">Services &amp; Integrations</div>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'Auth & Identity (OIDC)',
                      processingMs: 10,
                      maxWorkers: 25,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot blue" />
                    <span className="navbar-more-item-title">Identity Provider (OAuth2/OIDC)</span>
                  </div>
                  <span className="navbar-more-item-meta">10ms · 25w</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'Search Cluster (OpenSearch)',
                      processingMs: 18,
                      maxWorkers: 20,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot blue" />
                    <span className="navbar-more-item-title">Search Engine (OpenSearch)</span>
                  </div>
                  <span className="navbar-more-item-meta">18ms · 20w</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'Payment Gateway (Stripe)',
                      processingMs: 120,
                      maxWorkers: 8,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot amber" />
                    <span className="navbar-more-item-title">Payment API (Stripe / 3rd-Party)</span>
                  </div>
                  <span className="navbar-more-item-meta">120ms · Ext</span>
                </button>

                <div className="navbar-more-divider" />

                {/* 3. Messaging & Streams */}
                <div className="navbar-more-group-header">Async Messaging &amp; Queues</div>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('queue_consumer', {
                      label: 'Kafka Event Stream',
                      processingMs: 6,
                      maxWorkers: 40,
                      consumeRateRps: 150,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot blue" />
                    <span className="navbar-more-item-title">Kafka Event Stream</span>
                  </div>
                  <span className="navbar-more-item-meta">150 RPS · Log</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('queue_consumer', {
                      label: 'Async Task Worker (SQS)',
                      processingMs: 40,
                      maxWorkers: 15,
                      consumeRateRps: 60,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot blue" />
                    <span className="navbar-more-item-title">Async Worker Queue (SQS / Rabbit)</span>
                  </div>
                  <span className="navbar-more-item-meta">60 RPS · 15w</span>
                </button>

                <div className="navbar-more-divider" />

                {/* 4. Data Stores & Sinks */}
                <div className="navbar-more-group-header">Storage &amp; Data Sinks</div>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('service', {
                      label: 'Document DB (DynamoDB)',
                      processingMs: 14,
                      maxWorkers: 30,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot blue" />
                    <span className="navbar-more-item-title">Document Store (DynamoDB / Mongo)</span>
                  </div>
                  <span className="navbar-more-item-meta">14ms · NoSQL</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('ledger_sink', {
                      label: 'Cloud Object Storage (S3)',
                      processingMs: 35,
                      maxWorkers: 20,
                      dedupeByKey: false,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot green" />
                    <span className="navbar-more-item-title">Object Storage (AWS S3 / Blob)</span>
                  </div>
                  <span className="navbar-more-item-meta">35ms · Sink</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('ledger_sink', {
                      label: 'Immutable Audit Ledger',
                      processingMs: 50,
                      maxWorkers: 8,
                      dedupeByKey: true,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot green" />
                    <span className="navbar-more-item-title">Immutable Audit Ledger</span>
                  </div>
                  <span className="navbar-more-item-meta">50ms · Dedupe</span>
                </button>
                <button
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    addNode('ledger_sink', {
                      label: 'Observability Sink (ClickHouse)',
                      processingMs: 12,
                      maxWorkers: 30,
                      dedupeByKey: false,
                    });
                    setIsMorePrimitivesOpen(false);
                  }}
                >
                  <div className="navbar-more-item-left">
                    <span className="palette-dot green" />
                    <span className="navbar-more-item-title">Telemetry &amp; Log Sink (ClickHouse)</span>
                  </div>
                  <span className="navbar-more-item-meta">12ms · Metrics</span>
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
            if (onLeaveMeeting) {
              onLeaveMeeting();
            } else {
              setIsMeetingLive(false);
              onToastInfo('You have left the meeting.', 'Session Ended');
            }
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
              onToastWarning('Stopping active resilience simulation...', 'Simulation Halted');
              void experimentSession.cancelExperiment();
            }}
            title="Halt active resilience simulation"
          >
            Cancel Simulation
          </Button>
        ) : experimentSession.status === 'busy' ? (
          <Button
            variant="secondary"
            size="sm"
            style={{ border: '1px solid #f59e0b', color: '#fbbf24' }}
            onClick={() => {
              if (onOpenDiagnostics) {
                onOpenDiagnostics();
              } else {
                setActiveDrawer('telemetry');
              }
            }}
            title="Host lock active: another simulation is running or finalizing. Click to inspect or release."
          >
            Host Busy (Resolve)
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className={!canStartExperiment ? 'btn-simulation-blocked' : ''}
            onClick={() => {
              if (!canStartExperiment) {
                if (onOpenPreflightBlocker) {
                  onOpenPreflightBlocker();
                } else {
                  setActiveDrawer('telemetry');
                  onToastWarning(
                    board.nodes.length === 0
                      ? 'Add at least one service to canvas first.'
                      : `Architecture has ${String(board.validationProblems.length)} issue(s). Check the panel to resolve them.`,
                    'Cannot Simulate',
                  );
                }
                return;
              }
              setActiveDrawer('telemetry');
              void experimentSession.startExperiment(currentTopology);
            }}
            title={
              !canStartExperiment
                ? board.nodes.length === 0
                  ? 'Add at least one service to canvas to simulate'
                  : `Cannot simulate: ${String(board.validationProblems.length)} architecture issue(s) detected. Click to inspect.`
                : 'Run real-time resilience simulation (5s)'
            }
          >
            Run Simulation
          </Button>
        )}

        <AnalysisDropdown activeTab={activeDrawer} onSelectTab={setActiveDrawer} />

        <ImportDropdown
          onImportDiagram={() => setIsImportModalOpen(true)}
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
