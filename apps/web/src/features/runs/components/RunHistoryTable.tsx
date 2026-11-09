import type { RunId, RunRecord, RunSummary } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RunHistoryTableProps {
  readonly runs: readonly (RunRecord | RunSummary)[];
  readonly isLoading: boolean;
  readonly error?: string | null;
  readonly onRefresh: () => void;
  readonly onView: (id: RunId) => void;
  readonly onReplay: (id: RunId) => void;
  readonly onExport: (id: RunId) => void;
  readonly hideTitle?: boolean;
}

function getTopologyName(r: RunRecord | RunSummary): string {
  if ('topology' in r && r.topology && typeof r.topology === 'object' && 'name' in r.topology) {
    return r.topology.name;
  }
  if ('topologyName' in r && r.topologyName) {
    return r.topologyName;
  }
  return 'Topology';
}

function getFaultText(r: RunRecord | RunSummary): string {
  if ('faults' in r && Array.isArray(r.faults) && r.faults.length > 0) {
    const fault = r.faults[0];
    return fault ? `${fault.type} (${fault.edgeId})` : 'None';
  }
  if ('faultCount' in r && typeof r.faultCount === 'number') {
    return r.faultCount > 0 ? `${r.faultCount} fault${r.faultCount > 1 ? 's' : ''}` : 'None';
  }
  return 'None';
}

function getStartedAtText(r: RunRecord | RunSummary): string {
  if ('provenance' in r && r.provenance?.startedAt) {
    return new Date(r.provenance.startedAt).toLocaleString();
  }
  if ('createdAt' in r && r.createdAt) {
    return new Date(r.createdAt).toLocaleString();
  }
  return '—';
}

export function RunHistoryTable({
  runs,
  isLoading,
  error,
  onRefresh,
  onView,
  onReplay,
  onExport,
  hideTitle = false,
}: RunHistoryTableProps) {
  return (
    <Card
      title={hideTitle ? undefined : 'Recorded Simulation Runs'}
      actions={
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
          Refresh Runs
        </Button>
      }
      className="runs-table-card"
    >
      {error ? (
        <div style={{ padding: '6px 0' }}>
          <Alert variant="error" title="Unable to Load Execution History">
            <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
              {error.toLowerCase().includes('unauthorized') ||
              error.toLowerCase().includes('access denied') ||
              error.includes('401')
                ? 'Authenticating workspace session. Click Retry Connection to reload.'
                : error}
            </div>
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
              Retry Connection
            </Button>
          </Alert>
        </div>
      ) : isLoading ? (
        <div
          className="drawer-loading-box"
          style={{ border: 'none', padding: '12px 4px', background: 'transparent' }}
        >
          <div className="drawer-loading-header">
            <span className="agentic-pulse-spinner" />
            <span className="drawer-loading-label">
              Loading execution history from database...
            </span>
          </div>
          <div className="drawer-loading-indeterminate" />
        </div>
      ) : runs.length === 0 ? (
        <p className="state-message">No simulation runs recorded yet.</p>
      ) : (
        <div className="runs-vertical-list">
          {runs.map((r) => {
            const faultLabel = getFaultText(r);
            const topoName = getTopologyName(r);
            const startedAt = getStartedAtText(r);

            return (
              <div key={r.id} className="run-vertical-card">
                <div className="run-card-header">
                  <span className="cell-mono run-id-text" title={r.id}>
                    run:{r.id.slice(0, 8)}
                  </span>
                  <StatusPill
                    status={
                      r.overallStatus ?? (r.status === 'running' ? 'running' : 'INCONCLUSIVE')
                    }
                  />
                </div>
                <div className="run-card-details">
                  <div className="run-card-row">
                    <span className="run-field-label">Topology</span>
                    <span className="run-field-val font-semibold">{topoName}</span>
                  </div>
                  <div className="run-card-row">
                    <span className="run-field-label">Fault</span>
                    <span className="run-field-val cell-mono">{faultLabel}</span>
                  </div>
                  <div className="run-card-row">
                    <span className="run-field-label">Started</span>
                    <span className="run-field-val cell-mono">{startedAt}</span>
                  </div>
                </div>
                <div className="run-card-actions">
                  <Button variant="ghost" size="sm" onClick={() => onView(r.id)}>
                    Details
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onReplay(r.id)}>
                    Replay
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onExport(r.id)}>
                    Export JSON
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
