import type { NodeKind } from '@chaosboard/contracts';
import type { NodePresetConfig } from '../hooks/use-board-state';

export interface BoardToolbarProps {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly hasSelection: boolean;
  readonly selectedCount?: number;
  readonly validationProblemCount: number;
  readonly onAddNode: (kind: NodeKind, preset?: NodePresetConfig) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

export function BoardToolbar({
  nodeCount,
  edgeCount,
  hasSelection,
  selectedCount = 1,
  validationProblemCount,
  onAddNode,
  onDuplicate,
  onDelete,
}: BoardToolbarProps) {
  return (
    <div
      className="studio-architecture-toolbar"
      role="toolbar"
      aria-label="Architecture Components and Canvas Actions"
    >
      <div className="toolbar-row-actions">
        <div className="toolbar-actions-left">
          {/* Core Topology Component Creation */}
          <div className="toolbar-group">
            <button
              type="button"
              className="toolbar-item-btn"
              onClick={() => onAddNode('service')}
              title="Add Stateless Microservice (Key: 1)"
            >
              <span>+ Service</span>
            </button>

            <button
              type="button"
              className="toolbar-item-btn"
              onClick={() => onAddNode('cache')}
              title="Add In-Memory Cache (Key: 2)"
            >
              <span>+ Cache</span>
            </button>

            <button
              type="button"
              className="toolbar-item-btn"
              onClick={() => onAddNode('queue_consumer')}
              title="Add Queue Consumer (Key: 3)"
            >
              <span>+ Queue Consumer</span>
            </button>

            <button
              type="button"
              className="toolbar-item-btn"
              onClick={() => onAddNode('ledger_sink')}
              title="Add Transactional Ledger Sink (Key: 4)"
            >
              <span>+ Ledger Sink</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Selection Actions */}
          <button
            type="button"
            className="toolbar-action-tool"
            disabled={!hasSelection}
            onClick={onDuplicate}
            title="Duplicate selected element(s) (Cmd+D)"
          >
            <span>{selectedCount > 1 ? `Duplicate (${String(selectedCount)})` : 'Duplicate'}</span>
          </button>

          <button
            type="button"
            className="toolbar-action-tool danger"
            disabled={!hasSelection}
            onClick={onDelete}
            title="Delete selected element(s) (Del / Backspace)"
          >
            <span>{selectedCount > 1 ? `Delete (${String(selectedCount)})` : 'Delete'}</span>
          </button>
        </div>

        <div className="toolbar-actions-right">
          <span className="toolbar-stats-chip">
            Nodes: {nodeCount} &bull; Links: {edgeCount}
          </span>

          {validationProblemCount === 0 ? (
            <span
              className="toolbar-status-badge valid"
              title="Topology satisfies all distributed invariants"
            >
              <span className="status-dot green" />
              <span>Valid Mesh</span>
            </span>
          ) : (
            <span className="toolbar-status-badge warning" title="Topology has validation warnings">
              <span className="status-dot amber" />
              <span>{validationProblemCount} Issues</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
