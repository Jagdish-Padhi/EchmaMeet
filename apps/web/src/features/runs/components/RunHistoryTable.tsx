import { useState } from 'react';
import type { RunId, RunRecord } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RunHistoryTableProps {
  readonly runs: readonly RunRecord[];
  readonly isLoading: boolean;
  readonly error?: string | null;
  readonly onRefresh: () => void;
  readonly onView: (id: RunId) => void;
  readonly onReplay: (id: RunId) => void;
  readonly onExport: (id: RunId) => void;
  readonly hideTitle?: boolean;
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
  const [viewMode, setViewMode] = useState<'vertical' | 'table'>('vertical');

  return (
    <Card
      title={hideTitle ? undefined : 'Recorded Simulation Runs'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {runs.length > 0 && (
            <div className="layout-toggle-group" role="group" aria-label="Layout view mode">
              <button
                type="button"
                className={`layout-toggle-btn ${viewMode === 'vertical' ? 'active' : ''}`}
                onClick={() => setViewMode('vertical')}
                title="Vertical card layout"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="7" rx="2" />
                  <rect x="3" y="14" width="18" height="7" rx="2" />
                </svg>
                <span>Vertical</span>
              </button>
              <button
                type="button"
                className={`layout-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table spreadsheet layout"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
                <span>Table</span>
              </button>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
            Refresh Runs
          </Button>
        </div>
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
      ) : viewMode === 'vertical' ? (
        <div className="runs-vertical-list">
          {runs.map((r) => {
            const fault = r.faults[0];
            return (
              <div key={r.id} className="run-vertical-card">
                <div className="run-card-header">
                  <span className="cell-mono run-id-text">{r.id}</span>
                  <StatusPill
                    status={
                      r.overallStatus ?? (r.status === 'running' ? 'running' : 'INCONCLUSIVE')
                    }
                  />
                </div>
                <div className="run-card-details">
                  <div className="run-card-row">
                    <span className="run-field-label">Topology</span>
                    <span className="run-field-val font-semibold">{r.topology.name}</span>
                  </div>
                  <div className="run-card-row">
                    <span className="run-field-label">Fault</span>
                    <span className="run-field-val cell-mono">
                      {fault ? `${fault.type} (${fault.edgeId})` : 'None'}
                    </span>
                  </div>
                  <div className="run-card-row">
                    <span className="run-field-label">Started</span>
                    <span className="run-field-val cell-mono">
                      {new Date(r.provenance.startedAt).toLocaleString()}
                    </span>
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
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Overall Status</th>
                <th>Topology</th>
                <th>Fault Injected</th>
                <th>Started At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const fault = r.faults[0];
                return (
                  <tr key={r.id}>
                    <td className="cell-mono">{r.id}</td>
                    <td>
                      <StatusPill
                        status={
                          r.overallStatus ?? (r.status === 'running' ? 'running' : 'INCONCLUSIVE')
                        }
                      />
                    </td>
                    <td>{r.topology.name}</td>
                    <td>{fault ? `${fault.type} (${fault.edgeId})` : 'None'}</td>
                    <td className="cell-mono">
                      {new Date(r.provenance.startedAt).toLocaleString()}
                    </td>
                    <td>
                      <div className="action-buttons">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
