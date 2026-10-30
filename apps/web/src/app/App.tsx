import { useMemo, useState } from 'react';
import { topologyIdSchema, type Topology } from '@chaosboard/contracts';
import { createApiClient } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import {
  BoardCanvas,
  EdgeInspector,
  NodeInspector,
  ValidationBanner,
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
import { ScenarioPicker, useScenarios } from '../features/scenarios';
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
import { SystemStatus } from '../features/system-status';
import { edgeIdSchema, faultIdSchema, type RunId } from '@chaosboard/contracts';

export function App() {
  const api = useMemo(() => createApiClient(), []);
  const [activeTab, setActiveTab] = useState('board');
  const [selectedReportRunId, setSelectedReportRunId] = useState<RunId | null>(null);

  // Scenarios catalog
  const scenariosState = useScenarios(api);

  // Board canvas state
  const {
    board,
    loadTopology,
    updateNodePosition,
    selectNode,
    selectEdge,
    updateNode,
    updateEdgePolicy,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
  } = useBoardState(null, api);

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
    setActiveTab('board');
  });

  const selectedNode = board.nodes.find((n) => n.id === board.selectedNodeId) ?? null;
  const selectedEdge = board.edges.find((e) => e.id === board.selectedEdgeId) ?? null;

  const currentTopology: Topology = useMemo(() => {
    return {
      schemaVersion: 1,
      id: topologyIdSchema.parse(board.id),
      name: board.name,
      source: 'canvas',
      entry: { nodeId: board.entryNodeId },
      nodes: board.nodes.map((n) => {
        const nodeProps = { ...n };
        delete (nodeProps as { position?: unknown }).position;
        return nodeProps;
      }),
      edges: [...board.edges],
    };
  }, [board]);

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
        setActiveTab('board');
      }
    } else if (cmd.command === 'run_experiment') {
      setActiveTab('board');
      void experimentSession.startExperiment(currentTopology);
    } else if (cmd.command === 'start_repair') {
      setActiveTab('repair');
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
      setActiveTab('board');
    }
  });

  return (
    <div className="app-layout">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-emblem" aria-hidden="true">
            <svg
              className="brand-emblem-svg"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon
                points="16,3 29,10 29,24 16,30 3,24 3,10"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="16.5" r="4" fill="#38bdf8" />
              <circle
                cx="16"
                cy="16.5"
                r="7.5"
                stroke="#818cf8"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
          </div>
          <div className="brand-details">
            <div className="brand-row">
              <h1 className="app-title">ChaosBoard</h1>
              <span className="hackathon-badge">Meta AI Systems Track</span>
            </div>
            <span className="app-tagline">
              Autonomous Resilience Testing &amp; Self-Healing Architecture Engine
            </span>
          </div>
        </div>
        <SystemStatus />
      </header>

      {/* Main Navigation Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'board', label: 'Canvas & Chaos Experiment' },
          { id: 'vision', label: 'Photo Ingestion & Red-Stroke' },
          { id: 'voice', label: 'Voice Control' },
          { id: 'repair', label: 'Autonomous Repair' },
          { id: 'runs', label: 'Past Runs History', badge: runsHistory.runs.length },
          { id: 'reports', label: 'Report & Blueprint Export' },
          { id: 'benchmarks', label: 'Benchmark Results' },
        ]}
      />

      {/* Tab Panels */}
      <main className="tab-container">
        {/* Tab 1: Board & Chaos Experiment */}
        {activeTab === 'board' && (
          <div className="board-view-layout">
            {/* Scenarios Loader Drawer */}
            <ScenarioPicker
              scenarios={scenariosState.scenarios}
              selectedScenarioId={scenariosState.selectedScenarioId}
              isLoading={scenariosState.isLoading}
              error={scenariosState.error}
              onSelect={scenariosState.selectScenario}
              onLoadIntoBoard={(scenario) => {
                loadTopology(scenario.topology);
                const fault = scenario.faults[0];
                if (fault) {
                  experimentSession.updateFault(fault);
                }
                experimentSession.updateInvariants(scenario.invariants);
                experimentSession.updateTrialConfig(scenario.trialConfig);
              }}
            />

            {/* Validation Banner */}
            <ValidationBanner
              problems={board.validationProblems}
              isValidating={board.isValidating}
            />

            {/* Canvas and Inspector Grid */}
            <div className="canvas-and-inspectors">
              <div className="canvas-pane">
                <BoardCanvas
                  board={board}
                  onSelectNode={selectNode}
                  onSelectEdge={selectEdge}
                  onMoveNode={updateNodePosition}
                  onAddNode={addNode}
                  onAddEdge={addEdge}
                />
              </div>

              {/* Inspector Sidebar */}
              {(selectedNode || selectedEdge) && (
                <div className="inspector-pane">
                  {selectedNode && (
                    <NodeInspector
                      node={selectedNode}
                      onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                      onDelete={() => removeNode(selectedNode.id)}
                      onClose={() => selectNode(null)}
                    />
                  )}
                  {selectedEdge && (
                    <EdgeInspector
                      edge={selectedEdge}
                      onUpdatePolicy={(p) => updateEdgePolicy(selectedEdge.id, p)}
                      onDelete={() => removeEdge(selectedEdge.id)}
                      onClose={() => selectEdge(null)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Experiment Controls & Real-time Telemetry */}
            <div className="experiment-panels-grid">
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
                  void experimentSession.startExperiment(currentTopology);
                }}
                onCancel={() => {
                  void experimentSession.cancelExperiment();
                }}
                canStart={canStartExperiment}
              />
            </div>

            {/* Status & Live Telemetry Output */}
            <div className="live-execution-grid">
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
            </div>

            {/* Verdicts Display */}
            <VerdictsSummary
              verdicts={experimentSession.verdicts}
              overallStatus={experimentSession.overallStatus}
              finalRecord={experimentSession.finalRecord}
            />
          </div>
        )}

        {/* Tab 1.5: Photo Ingestion & Red-Stroke Gesture */}
        {activeTab === 'vision' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <Card title="Whiteboard / Sketch Photo Ingestion">
                <ImageUploader
                  onImageSelected={(file) => {
                    void visionFlow.uploadImage(file);
                  }}
                  isExtracting={visionFlow.isExtracting}
                />
              </Card>
            )}

            <Card title="Interactive Red-Stroke Gesture">
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#475569' }}>
                Draw a red stroke cutting across an active topology link to target it for chaos
                fault injection.
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
                    setActiveTab('board');
                  }}
                />
              )}
            </Card>
          </div>
        )}

        {/* Tab 1.6: Voice Control & Push-To-Talk */}
        {activeTab === 'voice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {voiceSession.error && <Alert variant="error">{voiceSession.error}</Alert>}

            <Card title="Push-to-Talk Spoken Command Bridge">
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

              <div style={{ marginTop: 16 }}>
                <VoiceTranscriptStream
                  partialTranscript={voiceSession.partialTranscript}
                  finalTranscript={voiceSession.finalTranscript}
                  isRecording={voiceSession.isRecording}
                  isProcessing={voiceSession.isProcessing}
                  timings={voiceSession.timings}
                />
              </div>

              <VoiceQuickCommands
                onSelectPhrase={(phrase) => {
                  void voiceSession.submitTranscript(phrase);
                }}
                isProcessing={voiceSession.isProcessing}
              />
            </Card>

            <ParsedCommandCard
              result={voiceSession.parseResult}
              autoConfirm={voiceSession.autoConfirm}
              onToggleAutoConfirm={voiceSession.toggleAutoConfirm}
              onConfirmAndExecute={() => {
                void voiceSession.confirmAndExecute();
              }}
              onClear={voiceSession.clearSession}
              onSelectCandidate={(cand) => {
                // if user selects an ambiguous candidate edge
                const match = currentTopology.edges.find((e) => e.id === cand);
                if (match) {
                  void voiceSession.submitTranscript(
                    `inject latency 300ms from ${match.source} to ${match.target}`,
                  );
                }
              }}
            />
          </div>
        )}

        {/* Tab 2: Autonomous Repair */}
        {activeTab === 'repair' && (
          <div className="repair-view-layout">
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
          </div>
        )}

        {/* Tab 3: Runs History */}
        {activeTab === 'runs' && (
          <div className="runs-view-layout">
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
          </div>
        )}

        {/* Tab 3.5: Report & Blueprint Export */}
        {activeTab === 'reports' &&
          (() => {
            const firstRun = runsHistory.runs[0];
            const activeReportRunId: RunId | null =
              selectedReportRunId ??
              experimentSession.runId ??
              runsHistory.selectedRunId ??
              (firstRun ? firstRun.id : null);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {runsHistory.runs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 13, color: '#94a3b8' }}>Select Run to Inspect:</label>
                    <select
                      value={activeReportRunId ?? ''}
                      onChange={(e) => {
                        setSelectedReportRunId(e.target.value as RunId);
                      }}
                      style={{
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 13,
                        fontFamily: 'monospace',
                      }}
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
                  <Card title="Run Report & Artifact Export">
                    <p style={{ color: '#94a3b8' }}>
                      No runs recorded yet. Run a chaos experiment or scenario from the Canvas tab
                      first to generate a deterministic report and blueprint card.
                    </p>
                  </Card>
                )}
              </div>
            );
          })()}

        {/* Tab 4: Benchmark Results */}
        {activeTab === 'benchmarks' && (
          <div className="benchmarks-view-layout">
            {benchmarksState.isLoading && (
              <p className="state-message">Loading benchmark suite results from storage...</p>
            )}
            {benchmarksState.error && (
              <p className="state-message error-message">{benchmarksState.error}</p>
            )}
            {benchmarksState.summary && (
              <>
                <ExecutiveSummaryCard summary={benchmarksState.summary} />
                <ComparisonTable results={benchmarksState.summary.results} />
                <RepairComparisonCard results={benchmarksState.summary.results} />
                <SurprisesSection />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
