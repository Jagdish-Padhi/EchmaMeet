import type { RunId, RunRecord } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RunHistoryTableProps {
  readonly runs: readonly RunRecord[];
  readonly isLoading: boolean;
  readonly onRefresh: () => void;
  readonly onView: (id: RunId) => void;
  readonly onReplay: (id: RunId) => void;
  readonly onExport: (id: RunId) => void;
}

export function RunHistoryTable({
  runs,
  isLoading,
  onRefresh,
  onView,
  onReplay,
  onExport,
}: RunHistoryTableProps) {
  return (
    <Card
      title="Past Chaos Runs"
      actions={
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
          Refresh Runs
        </Button>
      }
      className="runs-table-card"
    >
      {runs.length === 0 ? (
        <p className="state-message">
          {isLoading ? 'Loading run history...' : 'No past runs found in database.'}
        </p>
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
