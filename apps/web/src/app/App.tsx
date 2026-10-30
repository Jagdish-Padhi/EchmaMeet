import { useEffect, useMemo, useState } from 'react';
import {
  edgeIdSchema,
  faultIdSchema,
  type EdgeId,
  type NodeId,
  type RunId,
  type Topology,
} from '@chaosboard/contracts';
import { createApiClient } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import {
  AnalysisDropdown,
  BoardCanvas,
  BoardToolbar,
  EdgeInspector,
  ImportDiagramModal,
  NodeInspector,
  ValidationBanner,
  toTopology,
  useBoardState,
} from '../features/board';
import {
  FaultConfigForm,
  InvariantConfigForm,
  LiveTelemetryChart,
  TrialControls,
  TrialProgressCard,
  VerdictsSummary,
  useExperimentSession,
} from '../features/experiments';
import {
  IterationTimeline,
  RepairControls,
  TradeOffCard,
  useRepairSession,
} from '../features/repair';
import { ReplayModal, RunDetailView, RunHistoryTable, useRunsHistory } from '../features/runs';
import {
  ComparisonTable,
  ExecutiveSummaryCard,
  RepairComparisonCard,
  SurprisesSection,
  useBenchmarks,
} from '../features/benchmarks';
import { useScenarios } from '../features/scenarios';
import {
  GestureResultBanner,
  ImageUploader,
  RedStrokeCanvas,
  useVisionFlow,
  VisionDraftOverlay,
} from '../features/vision';
import {
  ParsedCommandCard,
  PushToTalkButton,
  useVoiceSession,
  VoiceQuickCommands,
  VoiceTranscriptStream,
} from '../features/voice';
import { ReportViewer } from '../features/reports';
import { LandingPage } from '../features/landing/LandingPage';
import {
  CanvasSreCallout,
  CreateMeetingModal,
  FloatingMeetingPiP,
  JoinMeetingModal,
  MeetingsDropdown,
  SreYieldFloorModal,
  useCollaborationPresence,
  useMeetingSreWatcher,
} from '../features/meeting';
import { ExportDropdown, IacExportModal } from '../features/repair';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  SettingsModal,
  type AppSettings,
} from '../features/settings/SettingsModal';

type StudioDrawerTab =
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

export function App() {
  const api = useMemo(() => createApiClient(), []);

  // View & Theme State
  const [view, setView] = useState<'landing' | 'studio'>('studio');
  const [settings, setSettings] = useState<AppSettings>(loadSettingsFromStorage);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<StudioDrawerTab>('none');
  const [selectedReportRunId, setSelectedReportRunId] = useState<RunId | null>(null);

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const handleToggleTheme = () => {
    const nextTheme: 'dark' | 'light' = settings.theme === 'dark' ? 'light' : 'dark';
    const updated: AppSettings = { ...settings, theme: nextTheme };
    setSettings(updated);
    saveSettingsToStorage(updated);
  };

  // Scenarios catalog
  const scenariosState = useScenarios(api);

  // Board canvas state
  const {
    board,
    loadTopology,
    importDiagram,
    updateNodePosition,
    selectNode,
    selectEdge,
    updateNode,
    updateEdgePolicy,
    addNode,
    duplicateNode,
    removeNode,
    addEdge,
    removeEdge,
  } = useBoardState(null, api);

  // Live Review Collaboration Room state
  const [isMeetingLive, setIsMeetingLive] = useState(false);
  const [meetingRoomCode, setMeetingRoomCode] = useState('#rfc-checkout-v2');
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isJoinMeetingOpen, setIsJoinMeetingOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIacModalOpen, setIsIacModalOpen] = useState(false);

  const handleCreateMeeting = (roomCode: string) => {
    setMeetingRoomCode(roomCode);
    setIsMeetingLive(true);
  };

  const handleJoinWithCode = (roomCode: string) => {
    setMeetingRoomCode(roomCode);
    setIsMeetingLive(true);
  };

  const handleJoinSoloAi = () => {
    setMeetingRoomCode('#solo-ai-sre');
    setIsMeetingLive(true);
  };

  // Multi-Cursor Real-Time Collaboration
  const [currentReviewer] = useState(() => ({
    userId: 'eng-alex-chen',
    name: 'Alex Chen',
    role: 'Staff SRE',
    avatar: 'AC',
  }));
  const { remoteReviewers, broadcastCursor } = useCollaborationPresence(
    currentReviewer,
    board.selectedNodeId,
  );

  // Meeting Room SRE Watcher
  const [isSreModalOpen, setIsSreModalOpen] = useState(false);
  const sreWatcher = useMeetingSreWatcher(board);

  // Experiments state
  const experimentSession = useExperimentSession(api, null);

  // Repair state
  const repairSession = useRepairSession(api);

  // Past runs state
  const runsHistory = useRunsHistory(api);

  // Benchmark suite results state
  const benchmarksState = useBenchmarks(api);

  // Vision flow state
  const visionFlow = useVisionFlow(api, (topology) => {
    loadTopology(topology);
    setActiveDrawer('none');
  });

  const selectedNode = board.nodes.find((n) => n.id === board.selectedNodeId) ?? null;
  const selectedEdge = board.edges.find((e) => e.id === board.selectedEdgeId) ?? null;

  const handleSelectNode = (id: NodeId | null) => {
    selectNode(id);
    if (id) {
      setActiveDrawer('inspect');
    }
  };

  const handleSelectEdge = (id: EdgeId | null) => {
    selectEdge(id);
    if (id) {
      setActiveDrawer('inspect');
    }
  };

  const currentTopology: Topology = useMemo(() => toTopology(board), [board]);

  const canStartExperiment = board.validationProblems.length === 0 && board.nodes.length > 0;

  // Voice session state
  const voiceSession = useVoiceSession(api, currentTopology, async (cmd) => {
    if (cmd.command === 'inject_fault') {
      const match = currentTopology.edges.find(
        (e) => e.source === cmd.source && e.target === cmd.target,
      );
      if (match) {
        const id = faultIdSchema.parse(`fault-${match.id}`);
        const edgeId = edgeIdSchema.parse(match.id);
        if (cmd.faultType === 'latency') {
          experimentSession.updateFault({
            id,
            edgeId,
            type: 'latency',
            latencyMs: cmd.parameters?.latencyMs ?? 300,
            jitterMs: cmd.parameters?.jitterMs ?? 50,
            toxicity: cmd.parameters?.toxicity ?? 1,
            direction: 'downstream',
            startOffsetMs: 0,
          });
        } else if (cmd.faultType === 'stall') {
          experimentSession.updateFault({
            id,
            edgeId,
            type: 'stall',
            holdMs: cmd.parameters?.holdMs ?? 500,
            toxicity: cmd.parameters?.toxicity ?? 1,
            direction: 'downstream',
            startOffsetMs: 0,
          });
        } else if (cmd.faultType === 'connection_reset') {
          experimentSession.updateFault({
            id,
            edgeId,
            type: 'connection_reset',
            afterMs: cmd.parameters?.resetAfterMs ?? 100,
            toxicity: cmd.parameters?.toxicity ?? 1,
            direction: 'downstream',
            startOffsetMs: 0,
          });
        } else {
          experimentSession.updateFault({
            id,
            edgeId,
            type: 'dependency_down',
            toxicity: 1,
            direction: 'downstream',
            startOffsetMs: 0,
          });
        }
        setActiveDrawer('chaos');
      }
    } else if (cmd.command === 'run_experiment') {
      setActiveDrawer('telemetry');
      void experimentSession.startExperiment(currentTopology);
    } else if (cmd.command === 'start_repair') {
      setActiveDrawer('repair');
      void repairSession.startRepair(
        currentTopology,
        experimentSession.fault,
        experimentSession.invariants,
        experimentSession.trialConfig,
      );
    } else if (cmd.command === 'cancel') {
      void experimentSession.cancelExperiment();
      void repairSession.cancelRepair();
    } else if (cmd.command === 'load_scenario') {
      const scenario = await api.getScenario(cmd.scenarioId);
      loadTopology(scenario.topology);
      setActiveDrawer('none');
    }
  });

  const handleLaunchStudioFromLanding = (scenarioId?: string) => {
    if (scenarioId) {
      const match = scenariosState.scenarios.find((s) => s.id === scenarioId);
      if (match) {
        loadTopology(match.topology);
        const fault = match.faults[0];
        if (fault) {
          experimentSession.updateFault(fault);
        }
        experimentSession.updateInvariants(match.invariants);
        experimentSession.updateTrialConfig(match.trialConfig);
      }
    }
    setView('studio');
  };

  const handleExportRfc = () => {
    const rfcMarkdown = [
      `# ChaosBoard Architecture Resilience RFC`,
      `**Room / Topology**: ${board.name} (\`${board.id}\`)`,
      `**Date**: ${new Date().toISOString().slice(0, 10)}`,
      `**Entry Node**: \`${board.entryNodeId}\``,
      '',
      `## Topology Mesh`,
      `- **Nodes (${String(board.nodes.length)})**: ${board.nodes.map((n) => `${n.label} [${n.kind}]`).join(', ')}`,
      `- **Edges (${String(board.edges.length)})**: ${board.edges
        .map(
          (e) =>
            `${e.source} -> ${e.target} (${
              e.policy.timeoutMs !== null ? `${String(e.policy.timeoutMs)}ms` : 'none'
            } timeout, ${String(e.policy.retry.maxAttempts)}x retries)`,
        )
        .join(', ')}`,
      '',
      `## SRE Watcher Hazards (${String(sreWatcher.hazards.length)})`,
      sreWatcher.hazards.length === 0
        ? `> No critical resilience anti-patterns detected.`
        : sreWatcher.hazards
            .map(
              (h) =>
                `- **[${h.severity.toUpperCase()}] ${h.title}**\n  - *Risk*: ${h.risk}\n  - *Recommendation*: ${h.recommendation}`,
            )
            .join('\n'),
      '',
      `## Verification & Proof`,
      `Generated via ChaosBoard Autonomous Resilience Engine (Meta Global AI Hackathon).`,
    ].join('\n');

    void navigator.clipboard.writeText(rfcMarkdown);
    alert('Resilience RFC copied to clipboard (Markdown ADR format)!');
  };

  // 1. Landing Page View
  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchStudio={handleLaunchStudioFromLanding}
          scenarios={scenariosState.scenarios}
          theme={settings.theme}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={setSettings}
          currentSettings={settings}
        />
      </>
    );
  }

  // 2. Studio Workspace View
  return (
    <div className="studio-root">
      {/* Minimalist Topbar */}
      <header className="studio-topbar">
        <div className="studio-brand-group">
          <button
            type="button"
            className="studio-brand-link"
            onClick={() => setView('landing')}
            title="Return to Product Overview"
          >
            <div className="brand-emblem" style={{ width: 28, height: 28 }} aria-hidden="true">
              <svg viewBox="0 0 32 32" width="16" height="16" fill="none">
                <polygon
                  points="16,3 29,10 29,24 16,30 3,24 3,10"
                  stroke="var(--color-accent)"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16.5" r="3.5" fill="var(--color-accent)" />
              </svg>
            </div>
            <span className="studio-brand-name">Resilio</span>
          </button>

          {/* Clean Enterprise Meetings Dropdown (Create, Join, Active Session) */}
          <MeetingsDropdown
            isMeetingActive={isMeetingLive}
            roomCode={meetingRoomCode}
            onOpenCreate={() => setIsCreateMeetingOpen(true)}
            onOpenJoin={() => setIsJoinMeetingOpen(true)}
            onLeaveMeeting={() => setIsMeetingLive(false)}
            onShareRoom={() => {
              const url = window.location.href;
              void navigator.clipboard.writeText(url);
            }}
          />

          <div className="studio-topbar-divider" />

          {/* Quick Scenario Switcher */}
          <select
            className="studio-scenario-select"
            value={scenariosState.selectedScenarioId ?? ''}
            onChange={(e) => {
              const scId = e.target.value;
              if (scId) {
                const sc = scenariosState.scenarios.find((s) => s.id === scId);
                if (sc) {
                  scenariosState.selectScenario(sc.id);
                  loadTopology(sc.topology);
                  const fault = sc.faults[0];
                  if (fault) experimentSession.updateFault(fault);
                  experimentSession.updateInvariants(sc.invariants);
                  experimentSession.updateTrialConfig(sc.trialConfig);
                }
              }
            }}
          >
            <option value="">Choose Scenario...</option>
            {scenariosState.scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clean Enterprise Actions */}
        <div className="studio-topbar-actions">
          {/* Primary Quick Run Action */}
          {experimentSession.status === 'running' || experimentSession.status === 'starting' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void experimentSession.cancelExperiment();
              }}
            >
              Cancel Run
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={!canStartExperiment}
              onClick={() => {
                setActiveDrawer('telemetry');
                void experimentSession.startExperiment(currentTopology);
              }}
              title="Run physical 5s sandbox resilience trial"
            >
              Sandbox Proof
            </Button>
          )}

          {/* Analysis & Drawer Tools Dropdown */}
          <AnalysisDropdown activeTab={activeDrawer} onSelectTab={setActiveDrawer} />

          {/* Export Artifacts Dropdown (IaC & RFC) */}
          <ExportDropdown
            onExportIac={() => setIsIacModalOpen(true)}
            onExportRfc={handleExportRfc}
          />

          {/* Quick Import Architecture Diagram */}
          <button
            type="button"
            className="navbar-meeting-btn"
            onClick={() => setIsImportModalOpen(true)}
            title="Import architecture from Mermaid flowchart or template"
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="meeting-btn-label">Import</span>
          </button>

          {/* Meta AI SRE Reviewer Pill */}
          <button
            type="button"
            className={`meta-ai-pill-btn ${sreWatcher.hazards.length > 0 ? 'has-hazards' : ''}`}
            onClick={() => setIsSreModalOpen(true)}
            title="Meta AI SRE continuous architectural resilience watcher"
          >
            <span className="meta-ai-dot" />
            <span>Meta AI</span>
          </button>

          <div className="studio-topbar-divider" />

          {/* Theme Toggle Button */}
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

          {/* Settings Gear Button */}
          <button
            type="button"
            className="btn-icon-toggle"
            onClick={() => setIsSettingsOpen(true)}
            title="Engine Settings"
            aria-label="Open settings"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Studio Canvas Layout */}
      <div className="studio-canvas-layout">
        {/* Spatial Canvas Container */}
        <main className="studio-canvas-main">
          {/* Top Architecture Palette & Canvas Controls Toolbar */}
          <BoardToolbar
            nodeCount={board.nodes.length}
            edgeCount={board.edges.length}
            hasSelection={Boolean(board.selectedNodeId || board.selectedEdgeId)}
            validationProblemCount={board.validationProblems.length}
            onAddNode={addNode}
            onDuplicate={() => {
              if (board.selectedNodeId) duplicateNode(board.selectedNodeId);
            }}
            onDelete={() => {
              if (board.selectedNodeId) {
                removeNode(board.selectedNodeId);
                if (activeDrawer === 'inspect') setActiveDrawer('none');
              } else if (board.selectedEdgeId) {
                removeEdge(board.selectedEdgeId);
                if (activeDrawer === 'inspect') setActiveDrawer('none');
              }
            }}
          />

          {/* Board Canvas */}
          <BoardCanvas
            board={board}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onMoveNode={updateNodePosition}
            onAddNode={addNode}
            onAddEdge={addEdge}
            onDuplicateNode={duplicateNode}
            remoteCursors={remoteReviewers}
            onCursorMove={broadcastCursor}
            onDeleteNode={(nodeId) => {
              removeNode(nodeId);
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            onDeleteEdge={(edgeId) => {
              removeEdge(edgeId);
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            hazardEdgeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetEdgeId ?? null) : null}
            hazardNodeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetNodeId ?? null) : null}
          />

          {/* SRE Risk Callout Card (Meta AI SRE in-canvas proactive alert) */}
          <CanvasSreCallout
            hazard={sreWatcher.primaryHazard}
            onOpenDetails={() => setIsSreModalOpen(true)}
            onTestInSandbox={() => {
              if (sreWatcher.primaryHazard) {
                const targetEdgeId = sreWatcher.primaryHazard.targetEdgeId;
                if (targetEdgeId) {
                  experimentSession.updateFault({
                    id: faultIdSchema.parse(`fault-proof-${String(Date.now())}`),
                    edgeId: targetEdgeId,
                    type: 'latency',
                    latencyMs: 300,
                    jitterMs: 50,
                    toxicity: 1,
                    direction: 'downstream',
                    startOffsetMs: 0,
                  });
                }
                setActiveDrawer('telemetry');
                void experimentSession.startExperiment(currentTopology);
              }
            }}
          />

          {/* Google Meet-Style Floating Picture-in-Picture Mini-Window (Bottom-Right) */}
          <FloatingMeetingPiP
            isActive={isMeetingLive}
            roomCode={meetingRoomCode}
            aiRaisedHand={sreWatcher.aiRaisedHand}
            onOpenSreFinding={() => setIsSreModalOpen(true)}
            onLeaveMeeting={() => setIsMeetingLive(false)}
          />
        </main>

        {/* Collapsible Right Dock / Inspector Panel */}
        {activeDrawer !== 'none' && (
          <aside className="studio-side-drawer" aria-label="Control and inspection panel">
            <div className="studio-drawer-header">
              <div className="studio-drawer-title">
                {activeDrawer === 'inspect' && 'Inspector'}
                {activeDrawer === 'chaos' && 'Chaos Fault & Invariants'}
                {activeDrawer === 'telemetry' && 'Live Telemetry & Verdicts'}
                {activeDrawer === 'repair' && 'Autonomous AI Repair'}
                {activeDrawer === 'voice' && 'Spoken Push-to-Talk'}
                {activeDrawer === 'vision' && 'Whiteboard Vision'}
                {activeDrawer === 'reports' && 'Export & Blueprint Card'}
                {activeDrawer === 'benchmarks' && 'Benchmark Suite'}
                {activeDrawer === 'runs' && 'Execution History'}
              </div>

              <button
                type="button"
                className="btn-close-drawer"
                onClick={() => {
                  selectNode(null);
                  selectEdge(null);
                  setActiveDrawer('none');
                }}
                title="Close drawer (Esc)"
                aria-label="Close drawer"
              >
                &times;
              </button>
            </div>

            <div className="studio-drawer-content">
              {/* Validation Status */}
              <ValidationBanner
                problems={board.validationProblems}
                isValidating={board.isValidating}
              />

              {/* 1. Inspector Tab */}
              {activeDrawer === 'inspect' && (
                <>
                  {selectedNode && (
                    <NodeInspector
                      node={selectedNode}
                      onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                      onDelete={() => {
                        removeNode(selectedNode.id);
                        setActiveDrawer('none');
                      }}
                      onClose={() => selectNode(null)}
                    />
                  )}
                  {selectedEdge && (
                    <EdgeInspector
                      edge={selectedEdge}
                      onUpdatePolicy={(p) => updateEdgePolicy(selectedEdge.id, p)}
                      onDelete={() => {
                        removeEdge(selectedEdge.id);
                        setActiveDrawer('none');
                      }}
                      onClose={() => selectEdge(null)}
                    />
                  )}
                  {!selectedNode && !selectedEdge && (
                    <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
                      Click on any node or edge on the canvas to inspect and configure its
                      parameters.
                    </p>
                  )}
                </>
              )}

              {/* 2. Chaos & Invariants Tab */}
              {activeDrawer === 'chaos' && (
                <>
                  <FaultConfigForm
                    fault={experimentSession.fault}
                    availableEdges={board.edges.map((e) => e.id)}
                    onChange={experimentSession.updateFault}
                    disabled={experimentSession.status === 'running'}
                  />

                  <InvariantConfigForm
                    invariants={experimentSession.invariants}
                    onChange={experimentSession.updateInvariants}
                    disabled={experimentSession.status === 'running'}
                  />

                  <TrialControls
                    config={experimentSession.trialConfig}
                    status={experimentSession.status}
                    onConfigChange={experimentSession.updateTrialConfig}
                    onStart={() => {
                      setActiveDrawer('telemetry');
                      void experimentSession.startExperiment(currentTopology);
                    }}
                    onCancel={() => {
                      void experimentSession.cancelExperiment();
                    }}
                    canStart={canStartExperiment}
                  />
                </>
              )}

              {/* 3. Telemetry & Verdicts Tab */}
              {activeDrawer === 'telemetry' && (
                <>
                  <TrialProgressCard
                    status={experimentSession.status}
                    currentTrial={experimentSession.currentTrialIndex}
                    totalTrials={experimentSession.totalTrials}
                    errorMessage={experimentSession.errorMessage}
                    runId={experimentSession.runId}
                  />

                  <LiveTelemetryChart
                    telemetry={experimentSession.telemetry}
                    currentTrial={experimentSession.currentTrialIndex}
                    totalTrials={experimentSession.totalTrials}
                  />

                  <VerdictsSummary
                    verdicts={experimentSession.verdicts}
                    overallStatus={experimentSession.overallStatus}
                    finalRecord={experimentSession.finalRecord}
                  />
                </>
              )}

              {/* 4. Autonomous Repair Tab */}
              {activeDrawer === 'repair' && (
                <>
                  <RepairControls
                    status={repairSession.status}
                    proposerKind={repairSession.proposerKind}
                    maxIterations={repairSession.maxIterations}
                    onProposerChange={repairSession.setProposerKind}
                    onMaxIterationsChange={repairSession.setMaxIterations}
                    onStart={() => {
                      void repairSession.startRepair(
                        currentTopology,
                        experimentSession.fault,
                        experimentSession.invariants,
                        experimentSession.trialConfig,
                      );
                    }}
                    onCancel={() => {
                      void repairSession.cancelRepair();
                    }}
                    canStart={canStartExperiment}
                  />

                  <TradeOffCard report={repairSession.tradeOffReport} />

                  <IterationTimeline iterations={repairSession.iterations} />
                </>
              )}

              {/* 5. Voice Tab */}
              {activeDrawer === 'voice' && (
                <>
                  {voiceSession.error && <Alert variant="error">{voiceSession.error}</Alert>}

                  <PushToTalkButton
                    isRecording={voiceSession.isRecording}
                    isProcessing={voiceSession.isProcessing}
                    onStartRecording={() => {
                      void voiceSession.startRecording();
                    }}
                    onStopRecording={() => {
                      voiceSession.stopRecording();
                    }}
                  />

                  <VoiceTranscriptStream
                    partialTranscript={voiceSession.partialTranscript}
                    finalTranscript={voiceSession.finalTranscript}
                    isRecording={voiceSession.isRecording}
                    isProcessing={voiceSession.isProcessing}
                    timings={voiceSession.timings}
                  />

                  <VoiceQuickCommands
                    onSelectPhrase={(phrase) => {
                      void voiceSession.submitTranscript(phrase);
                    }}
                    isProcessing={voiceSession.isProcessing}
                  />

                  <ParsedCommandCard
                    result={voiceSession.parseResult}
                    autoConfirm={voiceSession.autoConfirm}
                    onToggleAutoConfirm={voiceSession.toggleAutoConfirm}
                    onConfirmAndExecute={() => {
                      void voiceSession.confirmAndExecute();
                    }}
                    onClear={voiceSession.clearSession}
                    onSelectCandidate={(cand) => {
                      const match = currentTopology.edges.find((e) => e.id === cand);
                      if (match) {
                        void voiceSession.submitTranscript(
                          `inject latency 300ms from ${match.source} to ${match.target}`,
                        );
                      }
                    }}
                  />
                </>
              )}

              {/* 6. Vision Tab */}
              {activeDrawer === 'vision' && (
                <>
                  {visionFlow.error && <Alert variant="error">{visionFlow.error}</Alert>}

                  {visionFlow.imagePreviewUrl && visionFlow.extraction ? (
                    <VisionDraftOverlay
                      previewUrl={visionFlow.imagePreviewUrl}
                      extraction={visionFlow.extraction}
                      onConfirm={(draft) => {
                        void visionFlow.confirmDraft(draft);
                      }}
                      onCancel={visionFlow.reset}
                    />
                  ) : (
                    <ImageUploader
                      onImageSelected={(file) => {
                        void visionFlow.uploadImage(file);
                      }}
                      isExtracting={visionFlow.isExtracting}
                    />
                  )}

                  <div style={{ marginTop: 16 }}>
                    <p
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Draw a red stroke cutting across a link to target it for chaos fault
                      injection:
                    </p>
                    <RedStrokeCanvas
                      candidateEdges={currentTopology.edges.map((e, idx) => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        polyline: [
                          [0.2 + ((idx * 0.2) % 0.6), 0.4] as [number, number],
                          [0.4 + ((idx * 0.2) % 0.6), 0.4] as [number, number],
                        ],
                      }))}
                      onDetect={(stroke) => {
                        const candidates = currentTopology.edges.map((e, idx) => ({
                          id: e.id,
                          source: e.source,
                          target: e.target,
                          polyline: [
                            [0.2 + ((idx * 0.2) % 0.6), 0.4] as [number, number],
                            [0.4 + ((idx * 0.2) % 0.6), 0.4] as [number, number],
                          ],
                        }));
                        void visionFlow.triggerGestureDetection(stroke, candidates);
                      }}
                      isDetecting={visionFlow.isDetectingGesture}
                    />

                    {visionFlow.gestureResult && (
                      <GestureResultBanner
                        result={visionFlow.gestureResult}
                        onApplyFault={(fault) => {
                          experimentSession.updateFault(fault);
                          setActiveDrawer('chaos');
                        }}
                      />
                    )}
                  </div>
                </>
              )}

              {/* 7. Reports Tab */}
              {activeDrawer === 'reports' &&
                (() => {
                  const firstRun = runsHistory.runs[0];
                  const activeReportRunId: RunId | null =
                    selectedReportRunId ??
                    experimentSession.runId ??
                    runsHistory.selectedRunId ??
                    (firstRun ? firstRun.id : null);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {runsHistory.runs.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            Run:
                          </label>
                          <select
                            value={activeReportRunId ?? ''}
                            onChange={(e) => setSelectedReportRunId(e.target.value as RunId)}
                            className="input-select"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            {runsHistory.runs.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.id} ({r.topology.name} - {r.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {activeReportRunId ? (
                        <ReportViewer api={api} runId={activeReportRunId} />
                      ) : (
                        <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
                          No runs recorded yet. Execute a chaos run to generate reports.
                        </p>
                      )}
                    </div>
                  );
                })()}

              {/* 8. Benchmarks Tab */}
              {activeDrawer === 'benchmarks' && (
                <>
                  {benchmarksState.isLoading && (
                    <p style={{ color: 'var(--color-text-dim)' }}>Loading benchmark summary...</p>
                  )}
                  {benchmarksState.error && <Alert variant="error">{benchmarksState.error}</Alert>}
                  {benchmarksState.summary && (
                    <>
                      <ExecutiveSummaryCard summary={benchmarksState.summary} />
                      <ComparisonTable results={benchmarksState.summary.results} />
                      <RepairComparisonCard results={benchmarksState.summary.results} />
                      <SurprisesSection />
                    </>
                  )}
                </>
              )}

              {/* 9. Execution History Tab */}
              {activeDrawer === 'runs' && (
                <>
                  <RunHistoryTable
                    runs={runsHistory.runs}
                    isLoading={runsHistory.isLoading}
                    onRefresh={runsHistory.refreshRuns}
                    onView={runsHistory.viewRun}
                    onReplay={runsHistory.startReplay}
                    onExport={runsHistory.exportRunJson}
                  />

                  {runsHistory.selectedRunRecord && (
                    <RunDetailView
                      record={runsHistory.selectedRunRecord}
                      onClose={runsHistory.closeDetail}
                    />
                  )}

                  {runsHistory.replayingEvents && runsHistory.selectedRunId && (
                    <ReplayModal
                      runId={runsHistory.selectedRunId}
                      events={runsHistory.replayingEvents}
                      onClose={runsHistory.closeReplay}
                    />
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
        currentSettings={settings}
      />

      {/* Import Architecture Diagram Modal */}
      <ImportDiagramModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(nodes, edges, entryNodeId) => {
          importDiagram(nodes, edges, entryNodeId, 'Imported Architecture');
        }}
      />

      {/* Production Infrastructure-as-Code Export Modal */}
      <IacExportModal
        isOpen={isIacModalOpen}
        topology={currentTopology}
        onClose={() => setIsIacModalOpen(false)}
      />

      {/* Create Architecture Review Meeting Modal */}
      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
        onCreate={handleCreateMeeting}
      />

      {/* Join Architecture Review Meeting Modal (Code or Solo with AI) */}
      <JoinMeetingModal
        isOpen={isJoinMeetingOpen}
        onClose={() => setIsJoinMeetingOpen(false)}
        onJoinWithCode={handleJoinWithCode}
        onJoinSoloAi={handleJoinSoloAi}
      />

      {/* SRE Yield Floor Modal */}
      <SreYieldFloorModal
        isOpen={isSreModalOpen}
        hazards={sreWatcher.hazards}
        onClose={() => setIsSreModalOpen(false)}
        onApplyPatch={(edgeId, patch) => {
          const matchEdge = board.edges.find((e) => e.id === edgeId);
          if (matchEdge) {
            updateEdgePolicy(edgeId, {
              ...matchEdge.policy,
              ...patch,
              retry: {
                ...matchEdge.policy.retry,
                ...(patch.retry ?? {}),
              },
              breaker: {
                ...matchEdge.policy.breaker,
                ...(patch.breaker ?? {}),
              },
            });
          }
        }}
        onRunProof={(targetEdgeId) => {
          const matchEdge = board.edges.find((e) => e.id === targetEdgeId);
          if (matchEdge) {
            experimentSession.updateFault({
              id: faultIdSchema.parse(`fault-proof-${String(Date.now())}`),
              edgeId: targetEdgeId,
              type: 'latency',
              latencyMs: 300,
              jitterMs: 50,
              toxicity: 1,
              direction: 'downstream',
              startOffsetMs: 0,
            });
            setActiveDrawer('telemetry');
            void experimentSession.startExperiment(currentTopology);
          }
        }}
      />
    </div>
  );
}
