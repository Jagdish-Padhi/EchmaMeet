import type { RunRecord } from '@chaosboard/contracts';
import { Modal } from '../../../components/ui/Modal';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RunDetailViewProps {
  readonly record: RunRecord | null;
  readonly onClose: () => void;
}

export function RunDetailView({ record, onClose }: RunDetailViewProps) {
  if (!record) return null;

  return (
    <Modal title={`Run Details: ${record.id}`} isOpen={true} onClose={onClose}>
      <div className="run-detail-content">
        <div className="detail-header-meta">
          <StatusPill
            status={
              record.overallStatus ?? (record.status === 'running' ? 'running' : 'INCONCLUSIVE')
            }
          />
          <span>Topology: {record.topology.name}</span>
          <span>Fault: {record.faults[0]?.type ?? 'None'}</span>
        </div>

        <h4>Invariant Verdicts</h4>
        <table className="data-table">
          <thead>
            <tr>
              <th>Invariant ID</th>
              <th>Status</th>
              <th>Metric</th>
              <th>Threshold</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {record.verdicts.map((v) => (
              <tr key={v.invariantId}>
                <td className="cell-mono">{v.invariantId}</td>
                <td>
                  <StatusPill status={v.status} />
                </td>
                <td className="cell-mono">{v.evidence.metric}</td>
                <td className="cell-mono">{v.evidence.threshold}</td>
                <td>{v.reason ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Trials Aggregate</h4>
        <div className="trials-summary-grid">
          <div className="trials-summary-col">
            <h5>Baseline Condition</h5>
            <p>Valid Trials: {String(record.baselineAggregate?.validTrialsCount ?? 0)}</p>
            <p>Invalid Trials: {String(record.baselineAggregate?.invalidTrialsCount ?? 0)}</p>
          </div>
          <div className="trials-summary-col">
            <h5>Faulted Condition</h5>
            <p>Valid Trials: {String(record.faultedAggregate?.validTrialsCount ?? 0)}</p>
            <p>Invalid Trials: {String(record.faultedAggregate?.invalidTrialsCount ?? 0)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
