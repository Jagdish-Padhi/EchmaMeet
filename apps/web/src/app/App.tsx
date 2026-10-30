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
import { SystemStatus } from '../features/system-status';

export function App() {
  const api = useMemo(() => createApiClient(), []);
  const [activeTab, setActiveTab] = useState('board');

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

  return (
    <div className="app-layout">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <h1 className="app-title">ChaosBoard</h1>
          <span className="app-tagline">
            Design-time resilience testing. Draw a system, break it on purpose, measure it, repair
            it.
          </span>
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
          { id: 'repair', label: 'Autonomous Repair' },
          { id: 'runs', label: 'Past Runs History', badge: runsHistory.runs.length },
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
