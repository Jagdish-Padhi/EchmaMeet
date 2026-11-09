import type { RunRecord } from '@chaosboard/contracts';
import { Modal } from '../../../components/ui/Modal';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';

export interface RunDetailViewProps {
  readonly record: RunRecord | null;
  readonly onClose: () => void;
  readonly onReplay?: ((runId: string) => void) | undefined;
}

export function RunDetailView({ record, onClose, onReplay }: RunDetailViewProps) {
  if (!record) return null;

  const baselineP99 = record.baselineAggregate?.metrics.p99LatencyMs.median;
  const faultedP99 = record.faultedAggregate?.metrics.p99LatencyMs.median;
  const p99Diff =
    baselineP99 != null && faultedP99 != null
      ? (faultedP99 - baselineP99).toFixed(1)
      : null;

  const baselineP50 = record.baselineAggregate?.metrics.p50LatencyMs.median;
  const faultedP50 = record.faultedAggregate?.metrics.p50LatencyMs.median;

  const baselineSuccess = record.baselineAggregate?.metrics.completionRate.median;
  const faultedSuccess = record.faultedAggregate?.metrics.completionRate.median;

  const primaryFault = record.faults[0];
  const faultLabel = primaryFault
    ? `${primaryFault.type} on ${primaryFault.edgeId}`
    : 'Baseline Calibration Only';

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(record, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `run-${record.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal
      title="Simulation Run Details"
      isOpen={true}
      onClose={onClose}
      size="lg"
      className="run-detail-modal"
      actions={
        <div className="run-detail-actions">
          <Button variant="ghost" size="sm" onClick={handleDownloadJson}>
            Export JSON
          </Button>
          {onReplay && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onReplay(record.id);
              }}
            >
              Replay Events
            </Button>
          )}
        </div>
      }
    >
      <div className="run-audit-clean">
        {/* Top Summary Bar */}
        <div className="run-audit-summary-bar">
          <div className="summary-bar-item">
            <span className="summary-label">Status</span>
            <StatusPill
              status={
                record.overallStatus ?? (record.status === 'running' ? 'running' : 'INCONCLUSIVE')
              }
            />
          </div>
          <div className="summary-bar-item">
            <span className="summary-label">Topology</span>
            <span className="summary-val">{record.topology.name}</span>
          </div>
          <div className="summary-bar-item">
            <span className="summary-label">Injected Chaos</span>
            <span className="summary-val">{faultLabel}</span>
          </div>
          <div className="summary-bar-item">
            <span className="summary-label">Configured Load</span>
            <span className="summary-val">{String(record.trialConfig?.arrivalRateRps ?? 20)} RPS</span>
          </div>
        </div>

        {record.errorMessage && (
          <div className="run-audit-error">
            <span>{record.errorMessage}</span>
          </div>
        )}

        {/* Comparative Latency & Availability Grid */}
        <div className="run-audit-section">
          <div className="audit-section-heading">Phase Telemetry Comparison</div>
          <div className="audit-kpi-grid">
            <div className="audit-kpi-box">
              <span className="audit-kpi-name">Tail Latency (p99)</span>
              <div className="audit-kpi-split">
                <div>
                  <span className="kpi-tag">Base</span>
                  <span className="kpi-num">{baselineP99 != null ? `${baselineP99.toFixed(1)}ms` : '—'}</span>
                </div>
                <div className="kpi-arrow">→</div>
                <div>
                  <span className="kpi-tag">Fault</span>
                  <span className="kpi-num alert">{faultedP99 != null ? `${faultedP99.toFixed(1)}ms` : '—'}</span>
                </div>
              </div>
              {p99Diff != null && Number(p99Diff) > 0 && (
                <span className="audit-delta-tag regression">+{p99Diff}ms regression</span>
              )}
            </div>

            <div className="audit-kpi-box">
              <span className="audit-kpi-name">Median Latency (p50)</span>
              <div className="audit-kpi-split">
                <div>
                  <span className="kpi-tag">Base</span>
                  <span className="kpi-num">{baselineP50 != null ? `${baselineP50.toFixed(1)}ms` : '—'}</span>
                </div>
                <div className="kpi-arrow">→</div>
                <div>
                  <span className="kpi-tag">Fault</span>
                  <span className="kpi-num">{faultedP50 != null ? `${faultedP50.toFixed(1)}ms` : '—'}</span>
                </div>
              </div>
            </div>

            <div className="audit-kpi-box">
              <span className="audit-kpi-name">Success Rate</span>
              <div className="audit-kpi-split">
                <div>
                  <span className="kpi-tag">Base</span>
                  <span className="kpi-num">{baselineSuccess != null ? `${(baselineSuccess * 100).toFixed(1)}%` : '100%'}</span>
                </div>
                <div className="kpi-arrow">→</div>
                <div>
                  <span className="kpi-tag">Fault</span>
                  <span className="kpi-num">{faultedSuccess != null ? `${(faultedSuccess * 100).toFixed(1)}%` : '100%'}</span>
                </div>
              </div>
            </div>

            <div className="audit-kpi-box">
              <span className="audit-kpi-name">Recorded Trials</span>
              <div className="audit-kpi-split">
                <div>
                  <span className="kpi-tag">Base</span>
                  <span className="kpi-num">{String(record.baselineAggregate?.validTrialsCount ?? 0)}</span>
                </div>
                <div className="kpi-arrow">/</div>
                <div>
                  <span className="kpi-tag">Fault</span>
                  <span className="kpi-num">{String(record.faultedAggregate?.validTrialsCount ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invariant Verdicts Table */}
        <div className="run-audit-section">
          <div className="audit-section-heading">
            Resilience Invariants ({String(record.verdicts.length)})
          </div>
          {record.verdicts.length > 0 ? (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Invariant</th>
                    <th>Status</th>
                    <th>Measured</th>
                    <th>Threshold</th>
                    <th>Verdict Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {record.verdicts.map((v) => (
                    <tr key={v.invariantId}>
                      <td className="cell-mono font-medium">{v.invariantId}</td>
                      <td>
                        <StatusPill status={v.status} />
                      </td>
                      <td className="cell-mono">{v.evidence.metric}</td>
                      <td className="cell-mono text-muted">{v.evidence.threshold}</td>
                      <td className="text-muted">{v.reason ?? 'Threshold satisfied.'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="audit-empty">No invariants configured.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
