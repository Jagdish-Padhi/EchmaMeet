import { catalog, type NodeKind, type TopologyNode } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface NodeInspectorProps {
  readonly node: TopologyNode | null;
  readonly onUpdate: (patch: Partial<TopologyNode>) => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

export function NodeInspector({ node, onUpdate, onDelete, onClose }: NodeInspectorProps) {
  if (!node) return null;

  const { node: nodeBounds } = catalog;

  return (
    <Card
      title={`Node: ${node.label}`}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      }
      className="inspector-card"
    >
      <div className="inspector-fields">
        <label className="field-group">
          <span className="field-label">Label</span>
          <input
            type="text"
            className="input-text"
            value={node.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </label>

        <label className="field-group">
          <span className="field-label">Kind</span>
          <select
            className="input-select"
            value={node.kind}
            onChange={(e) => onUpdate({ kind: e.target.value as NodeKind })}
          >
            <option value="service">Service</option>
            <option value="cache">Cache</option>
            <option value="queue_consumer">Queue Consumer</option>
            <option value="ledger_sink">Ledger Sink</option>
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Max Concurrency (Workers)</span>
          <input
            type="number"
            className="input-number"
            min={nodeBounds.maxWorkers.min}
            max={nodeBounds.maxWorkers.max}
            value={node.concurrency.maxWorkers}
            onChange={(e) =>
              onUpdate({
                concurrency: { maxWorkers: parseInt(e.target.value, 10) || 1 },
              })
            }
          />
        </label>

        <label className="field-group">
          <span className="field-label">Queue Mode</span>
          <select
            className="input-select"
            value={node.queue.mode}
            onChange={(e) => {
              const mode = e.target.value as 'bounded' | 'unbounded';
              onUpdate({
                queue:
                  mode === 'bounded' ? { mode: 'bounded', maxDepth: 50 } : { mode: 'unbounded' },
              });
            }}
          >
            <option value="bounded">Bounded</option>
            <option value="unbounded">Unbounded</option>
          </select>
        </label>

        {node.queue.mode === 'bounded' && (
          <label className="field-group">
            <span className="field-label">Queue Max Depth</span>
            <input
              type="number"
              className="input-number"
              min={nodeBounds.queueDepth.min}
              max={nodeBounds.queueDepth.max}
              value={node.queue.maxDepth}
              onChange={(e) =>
                onUpdate({
                  queue: {
                    mode: 'bounded',
                    maxDepth: parseInt(e.target.value, 10) || 1,
                  },
                })
              }
            />
          </label>
        )}

        <div className="inspector-actions">
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete Node
          </Button>
        </div>
      </div>
    </Card>
  );
}
