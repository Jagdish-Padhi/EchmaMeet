import { useState } from 'react';
import type { RunId, RunRecord } from '@chaosboard/contracts';
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
}

export function RunHistoryTable({
  runs,
  isLoading,
  error,
  onRefresh,
  onView,
  onReplay,
  onExport,
}: RunHistoryTableProps) {
  const [viewMode, setViewMode] = useState<'vertical' | 'table'>('vertical');

  return (
    <Card
      title="Past Chaos Runs"
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
        <div className="table-error-banner" style={{ padding: '16px', color: '#f87171' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Server Connection Issue</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginBottom: 12 }}>
            Could not fetch run history from server. Ensure your backend service is running.
          </p>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Retry Connection
          </Button>
        </div>
      ) : runs.length === 0 ? (
        <p className="state-message">
          {isLoading ? 'Loading run history...' : 'No past runs found in database.'}
        </p>
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
