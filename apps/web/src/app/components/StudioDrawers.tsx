import type { NodeId, Topology, RunId } from '@chaosboard/contracts';
import { Alert } from '../../components/ui/Alert';
import type { ApiClient } from '../../api/client';
import {
  EdgeInspector,
  NodeInspector,
  ValidationBanner,
  type BoardNode,
  type BoardState,
} from '../../features/board';
import type { StudioDrawerTab } from './StudioNavbar';
import {
  FaultConfigForm,
  InvariantConfigForm,
  LiveTelemetryChart,
  TrialControls,
  TrialProgressCard,
  VerdictsSummary,
} from '../../features/experiments';
import { IterationTimeline, RepairControls, TradeOffCard } from '../../features/repair';
import {
  ParsedCommandCard,
  PushToTalkButton,
  VoiceControls,
  VoiceAnalyticsCard,
  VoiceQuickCommands,
  VoiceTranscriptStream,
} from '../../features/voice';
import {
  GestureResultBanner,
  ImageUploader,
  RedStrokeCanvas,
  VisionDraftOverlay,
} from '../../features/vision';
import { ReportViewer } from '../../features/reports';
import {
  ComparisonTable,
  ExecutiveSummaryCard,
  RepairComparisonCard,
  SurprisesSection,
} from '../../features/benchmarks';
import { ReplayModal, RunDetailView, RunHistoryTable } from '../../features/runs';

export interface StudioDrawersProps {
  readonly activeDrawer: StudioDrawerTab;
  readonly setActiveDrawer: (tab: StudioDrawerTab) => void;
  readonly board: BoardState;
  readonly selectedNode: BoardNode | null;
  readonly selectedEdge: any;
  readonly currentTopology: Topology;
  readonly canStartExperiment: boolean;
  readonly api: ApiClient;
  readonly experimentSession: any;
  readonly repairSession: any;
  readonly voiceSession: any;
  readonly visionFlow: any;
  readonly benchmarksState: any;
  readonly runsHistory: any;
  readonly selectedReportRunId: RunId | null;
  readonly setSelectedReportRunId: (id: RunId | null) => void;
  readonly handleSelectNode: (id: NodeId | null) => void;
  readonly selectEdge: (id: any) => void;
  readonly setEntryNode: (id: NodeId) => void;
  readonly onOpenPreflightBlocker?: (() => void) | undefined;
  readonly onOpenDiagnostics?: (() => void) | undefined;
  readonly updateNode: (id: NodeId, patch: any) => void;
  readonly updateEdgeControlPoint: (id: any, point: any) => void;
  readonly updateEdgePolicy: (id: any, policy: any) => void;
  readonly removeEdge: (id: any) => void;
}

export function StudioDrawers({
  activeDrawer,
  setActiveDrawer,
  board,
  selectedNode,
  selectedEdge,
  currentTopology,
  canStartExperiment,
  api,
  experimentSession,
  repairSession,
  voiceSession,
  visionFlow,
  benchmarksState,
  runsHistory,
  selectedReportRunId,
  setSelectedReportRunId,
  handleSelectNode,
  selectEdge,
  setEntryNode,
  onOpenPreflightBlocker,
  onOpenDiagnostics,
  updateNode,
  updateEdgeControlPoint,
  updateEdgePolicy,
  removeEdge,
}: StudioDrawersProps) {
  if (activeDrawer === 'none') return null;

  return (
    <aside className="studio-side-drawer" aria-label="Control and inspection panel">
      <div className="studio-drawer-header">
        <div className="studio-drawer-title-group">
          <div className="studio-drawer-title">
            {activeDrawer === 'inspect' &&
              (selectedNode ? 'Node Inspector' : selectedEdge ? 'Edge Inspector' : 'Inspector')}
            {activeDrawer === 'chaos' && 'Chaos Fault & Invariants'}
            {activeDrawer === 'telemetry' && 'Live Telemetry & Verdicts'}
            {activeDrawer === 'repair' && 'Autonomous AI Repair'}
            {activeDrawer === 'voice' && 'Spoken Push-to-Talk'}
            {activeDrawer === 'vision' && 'Whiteboard Vision'}
            {activeDrawer === 'reports' && 'Export & Blueprint Card'}
            {activeDrawer === 'benchmarks' && 'Benchmark Suite'}
            {activeDrawer === 'runs' && 'Execution History'}
          </div>
          {activeDrawer === 'inspect' && selectedNode && (
            <button
              type="button"
              className={`inspector-entry-btn ${board.entryNodeId === selectedNode.id ? 'active' : ''}`}
              onClick={() => setEntryNode(selectedNode.id)}
              title={
                board.entryNodeId === selectedNode.id
                  ? 'Current traffic entry point'
                  : 'Designate as traffic entry point'
              }
            >
              {board.entryNodeId === selectedNode.id ? 'Ingress Entry' : 'Set as Ingress'}
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn-close-drawer"
          onClick={() => {
            handleSelectNode(null);
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
        <ValidationBanner
          problems={board.validationProblems}
          isValidating={board.isValidating}
          nodes={board.nodes}
          onSelectNode={handleSelectNode}
          entryNodeId={board.entryNodeId}
          onFixEntryNode={() => {
            const firstNode = board.nodes[0];
            if (firstNode) setEntryNode(firstNode.id);
          }}
          entryNodeCandidateLabel={board.nodes[0]?.label}
        />

        {/* 1. Inspector Tab */}
        {activeDrawer === 'inspect' && (
          <>
            {selectedNode && (
              <NodeInspector
                node={selectedNode}
                onUpdate={(patch) => updateNode(selectedNode.id, patch)}
              />
            )}
            {selectedEdge && (
              <EdgeInspector
                edge={selectedEdge}
                hasCustomRoute={Boolean(board.edgeControlPoints?.[selectedEdge.id])}
                onResetRoute={() => updateEdgeControlPoint(selectedEdge.id, null)}
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
                Click on any node or edge on the canvas to inspect and configure its parameters.
              </p>
            )}
          </>
        )}

        {/* 2. Chaos & Invariants Tab */}
        {activeDrawer === 'chaos' && (
          <>
            <FaultConfigForm
              fault={experimentSession.fault}
              availableEdges={board.edges.map((e: any) => e.id)}
              edges={board.edges}
              nodes={board.nodes}
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
                if (!canStartExperiment) {
                  if (onOpenPreflightBlocker) {
                    onOpenPreflightBlocker();
                  }
                  return;
                }
                setActiveDrawer('telemetry');
                void experimentSession.startExperiment(currentTopology);
              }}
              onCancel={() => {
                void experimentSession.cancelExperiment();
              }}
              canStart={canStartExperiment}
              onForceReset={() => void experimentSession.forceResetExperiment?.()}
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
              config={experimentSession.trialConfig}
              onOpenDiagnostics={onOpenDiagnostics}
              onForceReset={() => void experimentSession.forceResetExperiment?.()}
              onRetry={() => {
                if (canStartExperiment) {
                  void experimentSession.startExperiment(currentTopology);
                } else if (onOpenPreflightBlocker) {
                  onOpenPreflightBlocker();
                }
              }}
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

            <VoiceControls
              language={voiceSession.language}
              onLanguageChange={voiceSession.setLanguage}
              speakReplies={voiceSession.speakReplies}
              onToggleSpeakReplies={voiceSession.toggleSpeakReplies}
              liveStatus={voiceSession.liveStatus}
              onStartLive={() => {
                void voiceSession.startLive();
              }}
              onStopLive={voiceSession.stopLive}
              isSpeaking={voiceSession.isSpeaking}
            />

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

            <VoiceAnalyticsCard api={api} refreshKey={voiceSession.parseResult?.transcript ?? ''} />

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
                Draw a red stroke cutting across a link to target it for chaos fault injection:
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
                    <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Run:</label>
                    <select
                      value={activeReportRunId ?? ''}
                      onChange={(e) => setSelectedReportRunId(e.target.value as RunId)}
                      className="input-select"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >
                      {runsHistory.runs.map((r: any) => (
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
              error={runsHistory.error}
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
  );
}
