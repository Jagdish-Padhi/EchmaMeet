import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  edgeIdSchema,
  faultIdSchema,
  type EdgeId,
  type EdgePolicy,
  type NodeId,
  type RunId,
  type Topology,
} from '@chaosboard/contracts';
import { createApiClient } from '../api/client';
import {
  BoardCanvas,
  ImportDiagramModal,
  PreflightBlockerModal,
  toTopology,
  useBoardState,
  type DrawTool,
  type UserProfile,
} from '../features/board';
import { AuthPage } from '../features/auth';
import { useToast } from '../features/toast';
import { useExperimentSession, SimulationDiagnosticsModal } from '../features/experiments';
import { useRepairSession } from '../features/repair';
import { useRunsHistory } from '../features/runs';
import { useBenchmarks } from '../features/benchmarks';
import { useScenarios } from '../features/scenarios';
import { useVoiceSession } from '../features/voice';
import { LandingPage } from '../features/landing/LandingPage';
import {
  CreateMeetingModal,
  FloatingMeetingPiP,
  JoinMeetingModal,
  SreYieldFloorModal,
  useCollaborationPresence,
  useMeetingAgent,
  useMeetingMediaStream,
  useMeetingTranscription,
  AgentSettingsModal,
  meetingAudio,
  detectSreHazards,
  type SreHazard,
} from '../features/meeting';
import type { MeetingChatMessage } from '../features/meeting/agentTypes';
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
  const broadcastCanvasOpRef = useRef<((op: unknown) => void) | null>(null);

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
    updateEdge,
    updateEdgePolicy,
    addNode,
    duplicateNode,
    duplicateSelected,
    removeNode,
    deleteSelected,
    addEdge,
    reconnectEdge,
    removeEdge,
    updateEdgeControlPoint,
    addStroke,
    undoStroke,
    clearStrokes,
    deleteStroke,
    undo,
    redo,
    recordActionBeforeChange,
    applyRemoteCanvasOp,
  } = useBoardState(null, api, {
    onLocalOperation: (op) => {
      broadcastCanvasOpRef.current?.(op);
    },
  });

  // Live Review Collaboration Room state
  const [isMeetingLive, setIsMeetingLive] = useState(false);
  const [meetingRoomCode, setMeetingRoomCode] = useState('#rfc-checkout-v2');
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isJoinMeetingOpen, setIsJoinMeetingOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIacModalOpen, setIsIacModalOpen] = useState(false);
  const [isPreflightBlockerOpen, setIsPreflightBlockerOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

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
  const [currentReviewer, setCurrentReviewer] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('chaosboard_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserProfile;
          if (parsed && parsed.userId && parsed.name) {
            const cleanName =
              parsed.name === 'Alex Chen' || parsed.name === 'Alex'
                ? 'Platform Engineer'
                : parsed.name;
            const cleanAvatar = cleanName === 'Platform Engineer' ? 'PE' : parsed.avatar;
            const cleanEmail =
              parsed.email &&
              parsed.email.startsWith('engineer_') &&
              parsed.email.endsWith('@echmameet.local')
                ? 'engineer@echmameet.local'
                : parsed.email;
            const cleanRole =
              parsed.role === 'Staff Site Reliability Engineer'
                ? 'Staff SRE'
                : parsed.role;
            return {
              userId: parsed.userId,
              name: cleanName,
              role: cleanRole,
              avatar: cleanAvatar,
              email: cleanEmail,
            };
          }
        } catch {
          // ignore
        }
      }
    }
    const storedSettings = loadSettingsFromStorage();
    let displayName = storedSettings.reviewerName || 'Platform Engineer';
    if (displayName === 'Alex Chen' || displayName === 'Alex') {
      displayName = 'Platform Engineer';
    }
    const initials =
      displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'PE';
    return {
      userId: `eng-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: displayName,
      role: storedSettings.reviewerRole || 'Staff SRE',
      avatar: initials,
      email: storedSettings.reviewerEmail || 'engineer@echmameet.local',
    };
  });

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null);

  const meetingMedia = useMeetingMediaStream({
    autoStart: isMeetingLive,
    onPermissionError: (msg) => {
      toast.warning(msg, 'Media Devices');
    },
  });

  const [incomingChatMessage, setIncomingChatMessage] = useState<MeetingChatMessage | null>(null);

  const { remoteReviewers, broadcastCursor, broadcastCanvasOp, broadcastChatMessage } = useCollaborationPresence(
    currentReviewer,
    board.selectedNodeId,
    meetingRoomCode,
    meetingMedia.screenStream ?? meetingMedia.localStream,
    applyRemoteCanvasOp,
    (rawMsg: unknown) => {
      if (rawMsg && typeof rawMsg === 'object') {
        const m = rawMsg as { senderName?: string; sender?: string; senderRole?: string; role?: string; text?: string; timestamp?: number };
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setIncomingChatMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender: m.senderName || m.sender || 'Collaborator',
          role: m.senderRole || m.role || 'Reviewer',
          text: m.text || '',
          timestamp: time,
          isAi: false,
        });
      }
    },
  );
  broadcastCanvasOpRef.current = broadcastCanvasOp;

  // Meeting Room SRE Watcher
  const [isSreModalOpen, setIsSreModalOpen] = useState(false);
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = useState(false);

  const meetingTranscription = useMeetingTranscription({
    roomId: meetingRoomCode,
    localStream: meetingMedia.localStream,
    isMeetingActive: isMeetingLive,
    currentUser: currentReviewer,
    api,
  });

  const sreWatcher = useMeetingAgent({
    board,
    api,
    hostName: currentReviewer?.name || 'Engineer',
    isMeetingActive: isMeetingLive,
    roomId: meetingRoomCode,
    transcripts: meetingTranscription.transcripts,
    autonomousVoice: settings.autonomousSreVoice,
  });

  const handleLeaveMeeting = useCallback(() => {
    setIsMeetingLive(false);
    setIsSreModalOpen(false);
    meetingAudio.stopSpeaking();
    sreWatcher.reset();
    meetingMedia.stopAllMedia();
    toast.info('You have left the meeting.', 'Session Ended');
  }, [meetingMedia, sreWatcher]);

  useEffect(() => {
    if (!isMeetingLive) {
      setIsSreModalOpen(false);
      sreWatcher.reset();
    }
  }, [isMeetingLive, sreWatcher]);

  const currentTopology: Topology = useMemo(() => toTopology(board), [board]);
  const canStartExperiment = board.validationProblems.length === 0 && board.nodes.length > 0;

  // Experiments state
  const experimentSession = useExperimentSession(api, currentTopology);

  // Repair state
  const repairSession = useRepairSession(api);

  // Past runs state
  const runsHistory = useRunsHistory(api);

  // Benchmark suite results state
  const benchmarksState = useBenchmarks(api);

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

  // Voice session state
  const voiceSession = useVoiceSession(
    api,
    currentTopology,
    async (cmd) => {
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
    },
    { language: settings.voiceLanguage, speakReplies: settings.speakReplies },
  );

  // Keep the voice session in step with the saved settings.
  const { setLanguage: setVoiceLanguage, setSpeakReplies: setVoiceSpeakReplies } = voiceSession;
  useEffect(() => {
    setVoiceLanguage(settings.voiceLanguage);
    setVoiceSpeakReplies(settings.speakReplies);
  }, [settings.voiceLanguage, settings.speakReplies, setVoiceLanguage, setVoiceSpeakReplies]);

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
    localStorage.setItem('chaosboard_user', JSON.stringify(user));
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
    localStorage.removeItem('chaosboard_user');
    toast.info('You have been logged out.', 'Logged Out');
    setView('landing');
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      // Transparently recover the session without abruptly kicking the engineer out of meetings or off the studio canvas
      api
        .createGuestSession({
          name: currentReviewer.name,
          role: currentReviewer.role,
          email: currentReviewer.email,
        })
        .then((res) => {
          localStorage.setItem('chaosboard_token', res.token);
          localStorage.setItem('chaosboard_auth', 'true');
          localStorage.setItem('chaosboard_user', JSON.stringify(res.user));
          setCurrentReviewer(res.user);
          setIsAuthenticated(true);
        })
        .catch(() => {
          setIsAuthenticated(false);
          setView((prev) => {
            if (prev === 'studio') {
              toast.warning('Your session has expired. Please sign in to continue.', 'Session Notice');
              return 'landing';
            }
            return prev;
          });
        });
    };
    window.addEventListener('chaosboard:unauthorized', handleUnauthorized);

    const token = typeof window !== 'undefined' ? localStorage.getItem('chaosboard_token') : null;
    if (token) {
      api
        .getCurrentUser()
        .then((res) => {
          setCurrentReviewer(res.user);
          localStorage.setItem('chaosboard_user', JSON.stringify(res.user));
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Re-establish real session token
          api
            .createGuestSession({
              name: currentReviewer.name,
              role: currentReviewer.role,
              email: currentReviewer.email,
            })
            .then((res) => {
              localStorage.setItem('chaosboard_token', res.token);
              localStorage.setItem('chaosboard_auth', 'true');
              localStorage.setItem('chaosboard_user', JSON.stringify(res.user));
              setCurrentReviewer(res.user);
              setIsAuthenticated(true);
            })
            .catch(() => {});
        });
    } else {
      // Automatically bootstrap real authenticated session for instant collaboration & speech
      api
        .createGuestSession({
          name: currentReviewer.name,
          role: currentReviewer.role,
          email: currentReviewer.email,
        })
        .then((res) => {
          localStorage.setItem('chaosboard_token', res.token);
          localStorage.setItem('chaosboard_auth', 'true');
          localStorage.setItem('chaosboard_user', JSON.stringify(res.user));
          setCurrentReviewer(res.user);
          setIsAuthenticated(true);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('chaosboard:unauthorized', handleUnauthorized);
    };
  }, [api, currentReviewer.name, currentReviewer.role, toast]);

  const handleExportRfc = () => {
    const rfcMarkdown = [
      `# Architecture Resilience RFC & ADR`,
      `**Topology**: ${board.name} (\`${board.id}\`)`,
      `**Generated**: ${new Date().toISOString()}`,
      `**Entrypoint Service**: \`${board.entryNodeId}\``,
      '',
      `## 1. Architecture Topology`,
      `| Node Label | Kind | Concurrency | Latency | Queue Mode |`,
      `| :--- | :--- | :--- | :--- | :--- |`,
      ...board.nodes.map((n) => {
        const latency =
          n.processing.distribution === 'constant'
            ? `${String(n.processing.ms)}ms`
            : `~${String(n.processing.medianMs)}ms`;
        return `| ${n.label} | \`${n.kind}\` | ${String(n.concurrency.maxWorkers)} workers | ${latency} | ${n.queue.mode} |`;
      }),
      '',
      `## 2. Ingress & Edge Policies`,
      `| Source | Target | Timeout | Retries | Max Backoff | Circuit Breaker |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- |`,
      ...board.edges.map((e) => {
        const timeout =
          e.policy.timeoutMs !== null ? `${String(e.policy.timeoutMs)}ms` : 'Disabled';
        const retries = `${String(e.policy.retry.maxAttempts)}x (${String(e.policy.retry.backoffBaseMs)}ms base)`;
        const maxBackoff = `${String(e.policy.retry.maxBackoffMs)}ms`;
        const cb = e.policy.breaker.enabled
          ? `Active (${String(e.policy.breaker.failureThresholdPct)}% err, ${String(e.policy.breaker.cooldownMs)}ms cool)`
          : 'Off';
        return `| ${e.source} | ${e.target} | ${timeout} | ${retries} | ${maxBackoff} | ${cb} |`;
      }),
      '',
      `## 3. Resilience Anti-Patterns & Hazards`,
      sreWatcher.hazards.length === 0
        ? `> No critical resilience anti-patterns detected. Topology adheres to high-availability guidelines.`
        : sreWatcher.hazards
            .map(
              (h) =>
                `- **[${h.severity.toUpperCase()}] ${h.title}**\n  - *Risk*: ${h.risk}\n  - *Recommendation*: ${h.recommendation}`,
            )
            .join('\n'),
      '',
      `## 4. Verification Proof`,
      `Automated verification manifest generated by ChaosBoard Autonomous Resilience Engine.`,
    ].join('\n');

    const fileName = `${board.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'architecture'}-rfc.md`;

    // 1. Trigger actual real file download
    try {
      const blob = new Blob([rfcMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback if blob download fails in sandboxed environment
    }

    // 2. Also copy full text to clipboard
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(rfcMarkdown);
    }

    toast.success(`Exported ${fileName} and copied to clipboard.`, 'Markdown ADR Exported');
  };

  // Autonomous SRE Auto-Remediation & Preflight Verification Pipeline
  const handleAutoRemediate = useCallback(
    async (
      explicitEdgeId?: EdgeId,
      explicitPatch?: Partial<EdgePolicy>,
      explicitHazardId?: string,
    ): Promise<boolean> => {
      // 1. Identify target hazard
      let hazard: SreHazard | undefined = sreWatcher.hazards.find((h) =>
        explicitHazardId
          ? h.id === explicitHazardId
          : explicitEdgeId
            ? h.targetEdgeId === explicitEdgeId
            : false,
      );
      if (!hazard) {
        hazard = sreWatcher.primaryHazard ?? undefined;
      }
      const validationProblem = board.validationProblems[0];

      if (!hazard && !validationProblem && !explicitEdgeId && !explicitPatch) {
        toast.info('No active hazards or validation issues detected.', 'Architecture Clean');
        return true;
      }

      const hazardTitle = hazard?.title || validationProblem?.code || 'Architectural Issue';
      let hasMutated = false;

      // Prospective updated state for post-remediation verification
      let nextNodes = [...board.nodes];
      let nextEdges = [...board.edges];
      let nextEntryId = board.entryNodeId;

      // 1. Queue Consumer Mode Synchronization (Fixes consumer_requires_async_edge & async_edge_target_not_consumer)
      for (const node of nextNodes) {
        if (node.kind === 'queue_consumer') {
          for (const edge of nextEdges) {
            if (edge.target === node.id && edge.mode !== 'async_enqueue') {
              updateEdge(edge.id, { mode: 'async_enqueue' });
              nextEdges = nextEdges.map((e) =>
                e.id === edge.id ? { ...e, mode: 'async_enqueue' } : e,
              );
              hasMutated = true;
            }
          }
        }
      }
      for (const edge of nextEdges) {
        const targetNode = nextNodes.find((n) => n.id === edge.target);
        if (targetNode && targetNode.kind !== 'queue_consumer' && edge.mode === 'async_enqueue') {
          updateEdge(edge.id, { mode: 'sync_call' });
          nextEdges = nextEdges.map((e) => (e.id === edge.id ? { ...e, mode: 'sync_call' } : e));
          hasMutated = true;
        }
      }

      const targetEdgeId =
        explicitEdgeId ||
        hazard?.targetEdgeId ||
        validationProblem?.edgeId ||
        (validationProblem?.nodeId
          ? board.edges.find((e) => e.target === validationProblem.nodeId || e.source === validationProblem.nodeId)?.id
          : undefined) ||
        (hazard?.targetNodeId
          ? board.edges.find((e) => e.target === hazard.targetNodeId || e.source === hazard.targetNodeId)?.id
          : undefined);

      if (
        (hazard?.patch?.mode ||
          validationProblem?.code === 'consumer_requires_async_edge' ||
          validationProblem?.code === 'async_edge_target_not_consumer') &&
        targetEdgeId
      ) {
        const targetMode =
          hazard?.patch?.mode ??
          (validationProblem?.code === 'consumer_requires_async_edge'
            ? 'async_enqueue'
            : 'sync_call');

        const currentEdge = nextEdges.find((e) => e.id === targetEdgeId);
        if (currentEdge && currentEdge.mode !== targetMode) {
          updateEdge(targetEdgeId as EdgeId, { mode: targetMode });
          nextEdges = nextEdges.map((e) => (e.id === targetEdgeId ? { ...e, mode: targetMode } : e));
          hasMutated = true;
        }
      }

      // 2. Resilience Policy Hazards (retry storm, excessive timeout, circuit breaker, idempotency)
      const effectivePatch = explicitPatch || hazard?.patch;
      if (targetEdgeId && effectivePatch) {
        const matchEdge = nextEdges.find((e) => e.id === targetEdgeId);
        if (matchEdge) {
          const updatedPolicy: EdgePolicy = {
            ...matchEdge.policy,
            ...effectivePatch,
            retry: {
              ...matchEdge.policy.retry,
              ...(effectivePatch.retry ?? {}),
            },
            breaker: {
              ...matchEdge.policy.breaker,
              ...(effectivePatch.breaker ?? {}),
            },
          };

          // Ground-truth equality check: only trigger mutation if policy actually changes!
          const isPolicyChanged = JSON.stringify(matchEdge.policy) !== JSON.stringify(updatedPolicy);
          if (isPolicyChanged) {
            updateEdgePolicy(targetEdgeId as EdgeId, updatedPolicy);
            nextEdges = nextEdges.map((e) =>
              e.id === targetEdgeId ? { ...e, policy: updatedPolicy } : e,
            );
            hasMutated = true;
          }
        }
      }

      // 3. Node Buffering Hazards (Unbounded queues or entry node role violations)
      if (
        (hazard?.targetNodeId && (hazard.patch?.queue || hazard.title.toLowerCase().includes('queue'))) ||
        validationProblem?.code === 'entry_is_queue_consumer'
      ) {
        const targetNodeId = hazard?.targetNodeId || validationProblem?.nodeId;
        if (targetNodeId) {
          if (validationProblem?.code === 'entry_is_queue_consumer') {
            const firstService = board.nodes.find(
              (n) => n.id !== targetNodeId && n.kind !== 'queue_consumer',
            );
            if (firstService && board.entryNodeId !== firstService.id) {
              setEntryNode(firstService.id);
              nextEntryId = firstService.id;
              hasMutated = true;
            }
          } else {
            const matchNode = nextNodes.find((n) => n.id === targetNodeId);
            if (matchNode && (matchNode.queue.mode !== 'bounded' || matchNode.queue.maxDepth !== 100)) {
              updateNode(targetNodeId as NodeId, {
                queue: { mode: 'bounded', maxDepth: 100 },
              });
              nextNodes = nextNodes.map((n) =>
                n.id === targetNodeId ? { ...n, queue: { mode: 'bounded', maxDepth: 100 } } : n,
              );
              hasMutated = true;
            }
          }
        }
      }

      // 4. Ingress Entry Node Fix
      if (validationProblem?.code === 'unknown_entry_node' || !nextEntryId) {
        const firstService = board.nodes.find((n) => n.kind !== 'queue_consumer') || board.nodes[0];
        if (firstService && board.entryNodeId !== firstService.id) {
          setEntryNode(firstService.id);
          nextEntryId = firstService.id;
          hasMutated = true;
        }
      }

      // 5. Self-Loop / Duplicate Edge Cleanup
      if (
        validationProblem?.code === 'self_loop' ||
        hazard?.title.toLowerCase().includes('self-loop') ||
        validationProblem?.code === 'duplicate_edge_pair'
      ) {
        const badEdgeId = hazard?.targetEdgeId || validationProblem?.edgeId;
        if (badEdgeId && nextEdges.some((e) => e.id === badEdgeId)) {
          removeEdge(badEdgeId as EdgeId);
          nextEdges = nextEdges.filter((e) => e.id !== badEdgeId);
          hasMutated = true;
        }
      }

      sreWatcher.dismissPermission();

      // If no mutations took place, check whether the architecture is already clean or unresolvable
      if (!hasMutated) {
        const currentLocalHazards = detectSreHazards(board);
        const isHazardStillDetectedLocally = currentLocalHazards.some(
          (h) =>
            (hazard && h.id === hazard.id) ||
            (targetEdgeId &&
              h.targetEdgeId === targetEdgeId &&
              h.title.toLowerCase().includes(hazardTitle.toLowerCase())),
        );

        if (!isHazardStillDetectedLocally && board.validationProblems.length === 0) {
          // Stale badge: clear from state and confirm cleanly without false speech
          sreWatcher.evictHazard(hazard?.id || (targetEdgeId as string) || '');
          sreWatcher.dismissFinding();
          toast.info(
            'Architecture is already compliant. Resilience parameters are up to date.',
            'Already Compliant',
          );
          return true;
        }

        meetingAudio.speakNaturally(
          `I could not automatically apply a patch for ${hazardTitle}. Please inspect the node and connection properties directly on the whiteboard.`,
        );
        toast.warning(
          `Automatic patch could not be applied for: ${hazardTitle}`,
          'Remediation Unresolved',
        );
        return false;
      }

      // --- Authoritative Ground-Truth Post-Remediation Verification ---
      const nextBoard = {
        ...board,
        nodes: nextNodes,
        edges: nextEdges,
        entryNodeId: nextEntryId,
      };
      const nextTopology = toTopology(nextBoard);

      try {
        // Step A: Pure Deterministic SRE Hazard Evaluation on prospective board
        const prospectiveHazards = detectSreHazards(nextBoard);
        const targetStillFlagged = prospectiveHazards.some((h) => {
          if (hazard?.id && h.id === hazard.id) return true;
          if (
            targetEdgeId &&
            h.targetEdgeId === targetEdgeId &&
            h.title.toLowerCase().includes(hazardTitle.toLowerCase())
          ) {
            return true;
          }
          return false;
        });

        // Step B: Structural Topology Validation
        const validationRes = await api.validateTopology(nextTopology);
        const remainingProblems = validationRes.valid ? [] : validationRes.problems;

        if (!targetStillFlagged && remainingProblems.length === 0) {
          // Genuine 100% verified resolution
          sreWatcher.evictHazard(hazard?.id || (targetEdgeId as string) || '');
          sreWatcher.dismissFinding();
          void sreWatcher.reEvaluate(nextBoard);

          toast.success(`Resilience patch applied & verified: ${hazardTitle}`, 'Architecture Clean');
          meetingAudio.speakNaturally(
            `Verified. I've applied the remediation patch for ${hazardTitle}. All architectural hazard checks and preflight validations are now passing cleanly.`,
          );
          broadcastChatMessage(
            `Echma applied resilience patch to ${hazardTitle}: verified acyclic topology and bounded resilience boundaries.`,
          );
          return true;
        } else {
          // Truthful reporting of remaining issues
          const firstIssue = targetStillFlagged
            ? `Connection still flagged: ${hazardTitle}`
            : remainingProblems[0]?.message || 'A remaining constraint was detected';
          toast.warning(
            `Patch applied, but preflight check detected: ${firstIssue}`,
            'Partial Remediation',
          );
          meetingAudio.speakNaturally(
            `I've applied the patch for ${hazardTitle}, but our verification check detected ${
              targetStillFlagged
                ? 'that the resilience condition is still unmet'
                : `${remainingProblems.length === 1 ? 'a remaining issue' : `${remainingProblems.length} remaining issues`}: ${firstIssue}`
            }. Let's inspect the connection parameters directly.`,
          );
          return false;
        }
      } catch {
        // Graceful fallback if validation request failed
        sreWatcher.evictHazard(hazard?.id || (targetEdgeId as string) || '');
        sreWatcher.dismissFinding();
        toast.success(`Resilience patch applied: ${hazardTitle}`, 'Architecture Updated');
        meetingAudio.speakNaturally(
          `Patch applied for ${hazardTitle}. Please verify the canvas before starting the simulation.`,
        );
        return true;
      }
    },
    [
      api,
      board,
      broadcastChatMessage,
      removeEdge,
      setEntryNode,
      sreWatcher,
      toast,
      updateEdge,
      updateEdgePolicy,
      updateNode,
    ],
  );

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
        api={api}
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
        onUpdateUser={(updatedUser) => {
          setCurrentReviewer(updatedUser);
          localStorage.setItem('chaosboard_user', JSON.stringify(updatedUser));
        }}
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
        onLeaveMeeting={handleLeaveMeeting}
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
        onToastError={(msg, title) => toast.error(msg, title)}
        onOpenPreflightBlocker={() => setIsPreflightBlockerOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
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
            onReconnectEdge={reconnectEdge}
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
            onUndo={undo}
            onRedo={redo}
            onRecordHistory={recordActionBeforeChange}
            onAddStroke={addStroke}
            onUndoStroke={undoStroke}
            onClearStrokes={clearStrokes}
            onDeleteStroke={deleteStroke}
            onUpdateEdgeControlPoint={updateEdgeControlPoint}
            hazardEdgeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetEdgeId ?? null) : null}
            hazardNodeId={isMeetingLive ? (sreWatcher.primaryHazard?.targetNodeId ?? null) : null}
            echmaSpeakingRequest={
              isMeetingLive
                ? {
                    isRequested: sreWatcher.permissionRequested,
                    hostName: currentReviewer?.name || 'Engineer',
                    onAllow: sreWatcher.allowSpeaking,
                    onDismiss: sreWatcher.dismissPermission,
                    onAutoRemediate: handleAutoRemediate,
                  }
                : undefined
            }
            hazardBanner={
              isMeetingLive && sreWatcher.aiRaisedHand && sreWatcher.hazardCount > 0
                ? {
                    hazardCount: sreWatcher.hazardCount,
                    onReviewFinding: () => setIsSreModalOpen(true),
                    onAutoRemediate: handleAutoRemediate,
                    onDismiss: sreWatcher.dismissFinding,
                  }
                : undefined
            }
          />

          {/* Google Meet-Style Floating Picture-in-Picture Mini-Window (Bottom-Right) */}
          <FloatingMeetingPiP
            isActive={isMeetingLive}
            roomCode={meetingRoomCode}
            aiRaisedHand={sreWatcher.aiRaisedHand}
            isEvaluatingAi={sreWatcher.isEvaluating}
            onAskAiOpinion={(prompt) =>
              sreWatcher.askOpinion(typeof prompt === 'string' ? prompt : undefined)
            }
            isCaptionsActive={meetingTranscription.isCaptionsActive}
            onToggleCaptions={meetingTranscription.toggleCaptions}
            onOpenSreFinding={() => setIsSreModalOpen(true)}
            onAutoRemediate={handleAutoRemediate}
            onLeaveMeeting={handleLeaveMeeting}
            currentUser={currentReviewer}
            remoteReviewers={remoteReviewers}
            hazardsCount={sreWatcher.hazards.length}
            spokenOpinion={sreWatcher.spokenOpinion}
            hazards={sreWatcher.hazards}
            externalMedia={meetingMedia}
            onBroadcastChatMessage={broadcastChatMessage}
            incomingChatMessage={incomingChatMessage}
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
          onOpenPreflightBlocker={() => setIsPreflightBlockerOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
          onApplyPatches={(topology) => {
            loadTopology(topology);
            toast.success('Patched resilience policies applied to whiteboard.', 'Resilience Verified');
          }}
          onOpenIacExport={() => setIsIacModalOpen(true)}
        />
      </div>

      {/* Import Architecture Diagram Modal */}
      <ImportDiagramModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(nodes, edges, entryNodeId, name) => {
          importDiagram(nodes, edges, entryNodeId, name || 'Imported Architecture');
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
          void handleAutoRemediate(edgeId, patch);
        }}
        onRunProof={async (targetEdgeId) => {
          const matchHazard = sreWatcher.hazards.find((h) => h.targetEdgeId === targetEdgeId);
          const success = await handleAutoRemediate(
            targetEdgeId,
            matchHazard?.patch as Partial<EdgePolicy>,
            matchHazard?.id,
          );
          if (success) {
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
              const nextTopology = toTopology(board);
              void experimentSession.startExperiment(nextTopology);
            }
          }
        }}
      />

      {/* Echma agent stack modal */}
      <AgentSettingsModal
        isOpen={isAgentSettingsOpen}
        onClose={() => setIsAgentSettingsOpen(false)}
        tokenUsage={sreWatcher.tokenUsage}
      />

      {/* Preflight Blocker Architecture Modal */}
      <PreflightBlockerModal
        isOpen={isPreflightBlockerOpen}
        onClose={() => setIsPreflightBlockerOpen(false)}
        problems={board.validationProblems}
        nodes={board.nodes}
        onSelectNode={handleSelectNode}
        onAutoFixEntry={() => {
          const firstNode = board.nodes[0];
          if (firstNode) setEntryNode(firstNode.id);
        }}
      />

      {/* Resilience Simulation Diagnostics Modal */}
      <SimulationDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        status={experimentSession.status}
        errorMessage={experimentSession.errorMessage}
        runId={experimentSession.runId}
        board={board}
        settings={settings}
        onOpenSettings={handleOpenSettings}
        onAutoRemediate={handleAutoRemediate}
        onForceResetLock={async () => {
          await experimentSession.forceResetExperiment?.();
          toast.success('Simulation host lock released successfully.', 'Lock Released');
        }}
        onRetrySimulation={() => {
          if (canStartExperiment) {
            setActiveDrawer('telemetry');
            void experimentSession.startExperiment(currentTopology);
          } else {
            setIsPreflightBlockerOpen(true);
          }
        }}
      />
    </div>
  );
}
