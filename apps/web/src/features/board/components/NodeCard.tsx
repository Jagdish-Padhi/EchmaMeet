import type { NodeId, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export interface NodeCardProps {
  readonly node: BoardNode;
  readonly isSelected: boolean;
  readonly isEntry: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: NodeId) => void;
  readonly onDragStart: (id: NodeId, e: React.MouseEvent<SVGGElement>) => void;
}

export function NodeCard({
  node,
  isSelected,
  isEntry,
  problems,
  onSelect,
  onDragStart,
}: NodeCardProps) {
  const hasProblems = problems.some((p) => p.nodeId === node.id);

  return (
    <g
      className={`canvas-node ${isSelected ? 'canvas-node-selected' : ''} ${
        hasProblems ? 'canvas-node-error' : ''
      }`}
      transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseDown={(e) => onDragStart(node.id, e)}
      role="button"
      tabIndex={0}
      aria-label={`Node ${node.label} (${node.kind})`}
    >
      {/* Node Container Box */}
      <rect
        width={180}
        height={90}
        rx={6}
        className="node-box"
        filter={isSelected ? 'url(#node-shadow)' : undefined}
      />

      {/* Entry badge */}
      {isEntry && (
        <g transform="translate(8, -10)">
          <rect width={50} height={18} rx={3} className="entry-badge-bg" />
          <text x={25} y={13} className="entry-badge-text" textAnchor="middle">
            ENTRY
          </text>
        </g>
      )}

      {/* Problem badge */}
      {hasProblems && (
        <g transform="translate(140, -10)">
          <rect width={32} height={18} rx={3} className="error-badge-bg" />
          <text x={16} y={13} className="error-badge-text" textAnchor="middle">
            ERR
          </text>
        </g>
      )}

      {/* Title */}
      <text x={12} y={28} className="node-title">
        {node.label}
      </text>

      {/* Kind badge */}
      <text x={12} y={48} className="node-kind-text">
        Kind: {node.kind}
      </text>

      {/* Metadata */}
      <text x={12} y={68} className="node-meta-text">
        Workers: {node.concurrency.maxWorkers} | Queue: {node.queue.mode}
      </text>
    </g>
  );
}
