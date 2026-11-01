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
import {
  BoardCanvas,
  ImportDiagramModal,
  toTopology,
  useBoardState,
  type DrawTool,
  type UserProfile,
} from '../features/board';
import { AuthPage } from '../features/auth';
import { useToast } from '../features/toast';
import { useExperimentSession } from '../features/experiments';
import { useRepairSession } from '../features/repair';
import { useRunsHistory } from '../features/runs';
import { useBenchmarks } from '../features/benchmarks';
import { useScenarios } from '../features/scenarios';
import { useVisionFlow } from '../features/vision';
import { useVoiceSession } from '../features/voice';
import { LandingPage } from '../features/landing/LandingPage';
import {
  CreateMeetingModal,
  FloatingMeetingPiP,
  JoinMeetingModal,
  SreYieldFloorModal,
  useCollaborationPresence,
  useMeetingSreWatcher,
} from '../features/meeting';
import { IacExportModal } from '../features/repair';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  SettingsPage,
  type AppSettings,
} from '../features/settings';
import { StudioNavbar } from './components/StudioNavbar';
import { StudioDrawers } from './components/StudioDrawers';

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
  const toast = useToast();

  // Enterprise Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chaosboard_auth') === 'true';
    }
    return false;
  });

  // View & Theme State
  const [view, setView] = useState<'landing' | 'studio' | 'auth' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.startsWith('#/auth') || hash === '#auth') return 'auth';
      if (hash.startsWith('#/settings') || hash === '#settings') return 'settings';
      if (hash.startsWith('#/studio') || hash === '#studio') return 'studio';

      // If already authenticated, directly show the architecture canvas
      if (localStorage.getItem('chaosboard_auth') === 'true') {
        return 'studio';
      }
    }
    return 'landing';
  });
  const [previousView, setPreviousView] = useState<'landing' | 'studio'>('studio');
  const [settings, setSettings] = useState<AppSettings>(loadSettingsFromStorage);
  const [activeDrawer, setActiveDrawer] = useState<StudioDrawerTab>('none');
  const [selectedReportRunId, setSelectedReportRunId] = useState<RunId | null>(null);

  // Canvas Drawing & Selection Tool Mode
  const [activeTool, setActiveTool] = useState<DrawTool>('select');
  const [penColor, setPenColor] = useState<string>('#38bdf8');
  const [penWidth, setPenWidth] = useState<number>(3);

  const handleOpenSettings = () => {
    setPreviousView(view === 'landing' ? 'landing' : 'studio');
    setView('settings');
  };

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
    moveSelectedNodes,
    selectNode,
    selectNodes,
    selectEdge,
    setEntryNode,
    updateNode,
    updateEdgePolicy,
    addNode,
    duplicateNode,
    duplicateSelected,
    removeNode,
    deleteSelected,
    alignSelected,
    addEdge,
    removeEdge,
    updateEdgeControlPoint,
    addStroke,
    undoStroke,
    clearStrokes,
    deleteStroke,
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

  // Multi-Cursor Real-Time Collaboration & Identity
  const [currentReviewer, setCurrentReviewer] = useState<UserProfile>(() => ({
    userId: 'eng-alex-chen',
    name: 'Alex Chen',
    role: 'Staff SRE',
    avatar: 'AC',
    email: 'alex.chen@meta.internal',
  }));

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null);
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
    if (!isAuthenticated) {
      setPendingScenarioId(scenarioId ?? null);
      setAuthMode('login');
      setView('auth');
      return;
    }

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

  const handleOpenAuthFromLanding = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setView('auth');
  };

  const handleAuthenticated = (user: UserProfile) => {
    setIsAuthenticated(true);
    localStorage.setItem('chaosboard_auth', 'true');
    setCurrentReviewer(user);
    toast.success(`Welcome, ${user.name}!`, 'Authenticated');
    if (pendingScenarioId) {
      const match = scenariosState.scenarios.find((s) => s.id === pendingScenarioId);
      if (match) {
        scenariosState.selectScenario(match.id);
        loadTopology(match.topology);
        const fault = match.faults[0];
        if (fault) {
          experimentSession.updateFault(fault);
        }
        experimentSession.updateInvariants(match.invariants);
        experimentSession.updateTrialConfig(match.trialConfig);
      }
      setPendingScenarioId(null);
    }
    setView('studio');
  };

  const handleSignOut = () => {
    void api.logout().catch(() => {});
    setIsAuthenticated(false);
    localStorage.removeItem('chaosboard_auth');
    localStorage.removeItem('chaosboard_token');
    toast.info('You have been logged out.', 'Logged Out');
    setView('landing');
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setView((prev) => {
        if (prev === 'studio') {
          toast.warning('Your session has expired. Please sign in to continue.', 'Session Notice');
          return 'landing';
        }
        return prev;
      });
    };
    window.addEventListener('chaosboard:unauthorized', handleUnauthorized);

    const token = typeof window !== 'undefined' ? localStorage.getItem('chaosboard_token') : null;
    if (token) {
      api
        .getCurrentUser()
        .then((res) => {
          setCurrentReviewer(res.user);
          setIsAuthenticated(true);
        })
        .catch(() => {
          setIsAuthenticated(false);
          localStorage.removeItem('chaosboard_auth');
          localStorage.removeItem('chaosboard_token');
        });
    }

    return () => {
      window.removeEventListener('chaosboard:unauthorized', handleUnauthorized);
    };
  }, [api, toast]);

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

  // 1. Landing Page View (Only shown if user is NOT authenticated)
  if (view === 'landing' && !isAuthenticated) {
    return (
      <LandingPage
        onLaunchStudio={handleLaunchStudioFromLanding}
        scenarios={scenariosState.scenarios}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        isAuthenticated={isAuthenticated}
        onOpenAuth={handleOpenAuthFromLanding}
      />
    );
  }

  // 2. Dedicated Auth Page View (HackDekh 2-Part Architecture)
  if (view === 'auth') {
    return (
      <AuthPage
        api={api}
        onAuthenticate={handleAuthenticated}
        onBackToHome={() => {
          setView('landing');
          setPendingScenarioId(null);
        }}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        initialMode={authMode}
        pendingScenarioName={
          pendingScenarioId
            ? (scenariosState.scenarios.find((s) => s.id === pendingScenarioId)?.name ?? null)
            : null
        }
      />
    );
  }

  // 3. Dedicated Full-Page Settings View (GitHub-Style 3-Zone Architecture)
  if (view === 'settings') {
    return (
      <SettingsPage
        currentSettings={settings}
        onSave={(updated) => {
          setSettings(updated);
          saveSettingsToStorage(updated);
          if (updated.theme !== settings.theme) {
            document.documentElement.setAttribute('data-theme', updated.theme);
          }
        }}
        onBack={() => setView(previousView)}
        currentUser={currentReviewer}
        onUpdateUser={(updatedUser) => setCurrentReviewer(updatedUser)}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // 2. Studio Workspace View
  return (
    <div className="studio-root">
      <StudioNavbar
        board={board}
        activeDrawer={activeDrawer}
        setActiveDrawer={setActiveDrawer}
        setView={setView}
        addNode={addNode}
        duplicateSelected={duplicateSelected}
        deleteSelected={deleteSelected}
        isMeetingLive={isMeetingLive}
        meetingRoomCode={meetingRoomCode}
        currentReviewer={currentReviewer}
        remoteReviewers={remoteReviewers}
        setIsCreateMeetingOpen={setIsCreateMeetingOpen}
        setIsJoinMeetingOpen={setIsJoinMeetingOpen}
        setIsMeetingLive={setIsMeetingLive}
        experimentSession={experimentSession}
        canStartExperiment={canStartExperiment}
        currentTopology={currentTopology}
        scenariosState={scenariosState}
        loadTopology={loadTopology}
        setIsImportModalOpen={setIsImportModalOpen}
        setIsIacModalOpen={setIsIacModalOpen}
        handleExportRfc={handleExportRfc}
        settings={settings}
        handleToggleTheme={handleToggleTheme}
        handleOpenSettings={handleOpenSettings}
        handleSignOut={handleSignOut}
        onToastInfo={(msg, title) => toast.info(msg, title)}
        onToastSuccess={(msg, title) => toast.success(msg, title)}
        onToastWarning={(msg, title) => toast.warning(msg, title)}
      />

      {/* Main Studio Canvas Layout */}
      <div className="studio-canvas-layout">
        {/* Spatial Canvas Container */}
        <main className="studio-canvas-main">
          {/* Board Canvas with Excalidraw-Grade Pen & Marquee Crop Tools */}
          <BoardCanvas
            board={board}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            penColor={penColor}
            onSelectPenColor={setPenColor}
            penWidth={penWidth}
            onSelectPenWidth={setPenWidth}
            onSelectNode={handleSelectNode}
            onSelectNodes={(ids) => {
              selectNodes(ids);
              if (ids.length === 1 && ids[0]) {
                selectNode(ids[0]);
                setActiveDrawer('inspect');
              }
            }}
            onSelectEdge={handleSelectEdge}
            onMoveNode={updateNodePosition}
            onMoveSelectedNodes={moveSelectedNodes}
            onAddNode={addNode}
            onAddEdge={addEdge}
            onDuplicateNode={duplicateNode}
            onDuplicateSelected={duplicateSelected}
            remoteCursors={remoteReviewers}
            onCursorMove={broadcastCursor}
            onDeleteNode={(nodeId) => {
              removeNode(nodeId);
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            onDeleteSelected={() => {
              deleteSelected();
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            onDeleteEdge={(edgeId) => {
              removeEdge(edgeId);
              if (activeDrawer === 'inspect') setActiveDrawer('none');
            }}
            onAlignSelected={alignSelected}
            onAddStroke={addStroke}
            onUndoStroke={undoStroke}
            onClearStrokes={clearStrokes}
            onDeleteStroke={deleteStroke}
            onUpdateEdgeControlPoint={updateEdgeControlPoint}
            hazardEdgeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetEdgeId ?? null) : null}
            hazardNodeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetNodeId ?? null) : null}
          />

          {/* Google Meet-Style Floating Picture-in-Picture Mini-Window (Bottom-Right) */}
          <FloatingMeetingPiP
            isActive={isMeetingLive}
            roomCode={meetingRoomCode}
            aiRaisedHand={sreWatcher.aiRaisedHand}
            onOpenSreFinding={() => setIsSreModalOpen(true)}
            onLeaveMeeting={() => setIsMeetingLive(false)}
            currentUser={currentReviewer}
            remoteReviewers={remoteReviewers}
            hazardsCount={sreWatcher.hazards.length}
          />
        </main>

        {/* Collapsible Right Dock / Inspector Panel */}
        <StudioDrawers
          activeDrawer={activeDrawer}
          setActiveDrawer={setActiveDrawer}
          board={board}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          currentTopology={currentTopology}
          canStartExperiment={canStartExperiment}
          api={api}
          experimentSession={experimentSession}
          repairSession={repairSession}
          voiceSession={voiceSession}
          visionFlow={visionFlow}
          benchmarksState={benchmarksState}
          runsHistory={runsHistory}
          selectedReportRunId={selectedReportRunId}
          setSelectedReportRunId={setSelectedReportRunId}
          handleSelectNode={handleSelectNode}
          selectEdge={selectEdge}
          setEntryNode={setEntryNode}
          updateNode={updateNode}
          updateEdgeControlPoint={updateEdgeControlPoint}
          updateEdgePolicy={updateEdgePolicy}
          removeEdge={removeEdge}
        />
      </div>

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
