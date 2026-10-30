import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export interface NodeCardProps {
  readonly node: BoardNode;
  readonly isSelected: boolean;
  readonly isEntry: boolean;
  readonly isHazard?: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: NodeId) => void;
  readonly onDragStart: (id: NodeId, e: ReactMouseEvent<SVGGElement>) => void;
  readonly onStartConnect?: (sourceId: NodeId, e: ReactMouseEvent<SVGElement>) => void;
  readonly onDropConnect?: (targetId: NodeId) => void;
}

export function NodeCard({
  node,
  isSelected,
  isEntry,
  isHazard,
  problems,
  onSelect,
  onDragStart,
  onStartConnect,
  onDropConnect,
}: NodeCardProps) {
  const hasProblems = problems.some((p) => p.nodeId === node.id);

  const getKindColor = (kind: string): string => {
    switch (kind) {
      case 'service':
        return '#38bdf8'; // Sky Cyan
      case 'cache':
        return '#f59e0b'; // Amber
      case 'queue_consumer':
        return '#a855f7'; // Violet
      case 'ledger_sink':
        return '#10b981'; // Emerald Green
      default:
        return '#38bdf8';
    }
  };

  const kindColor = getKindColor(node.kind);

  return (
    <g
      className={`canvas-node ${isSelected ? 'canvas-node-selected' : ''} ${
        hasProblems ? 'canvas-node-error' : ''
      } ${isHazard ? 'canvas-node-hazard' : ''}`}
      transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseDown={(e) => onDragStart(node.id, e)}
      onMouseUp={() => onDropConnect?.(node.id)}
      role="button"
      tabIndex={0}
      aria-label={`Node ${node.label} (${node.kind})`}
    >
      {/* Radar Hazard Pulsing Ring */}
      {isHazard && (
        <rect
          x={-5}
          y={-5}
          width={190}
          height={100}
          rx={12}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          className="hazard-pulse-ring"
        />
      )}

      {/* Node Container Box */}
      <rect
        width={180}
        height={90}
        rx={8}
        className="node-box"
        filter={isSelected ? 'url(#node-shadow)' : undefined}
      />

      {/* Top Accent Stripe based on Kind */}
      <rect x={1} y={1} width={178} height={3} rx={1.5} fill={kindColor} />

      {/* Entry badge */}
      {isEntry && (
        <g transform="translate(8, -10)">
          <rect width={54} height={18} rx={4} className="entry-badge-bg" />
          <text x={27} y={13} className="entry-badge-text" textAnchor="middle">
            ENTRY
          </text>
        </g>
      )}

      {/* Problem badge */}
      {hasProblems && (
        <g transform="translate(136, -10)">
          <rect width={36} height={18} rx={4} className="error-badge-bg" />
          <text x={18} y={13} className="error-badge-text" textAnchor="middle">
            ERR
          </text>
        </g>
      )}

      {/* Title */}
      <text x={14} y={28} className="node-title">
        {node.label}
      </text>

      {/* Kind indicator dot & text */}
      <circle cx={18} cy={44} r={3.5} fill={kindColor} />
      <text x={26} y={48} className="node-kind-text">
        {node.kind.replace('_', ' ')}
      </text>

      {/* Metadata Pill */}
      <rect
        x={10}
        y={58}
        width={160}
        height={22}
        rx={4}
        fill="rgba(15, 23, 42, 0.6)"
        stroke="rgba(255, 255, 255, 0.05)"
      />
      <text x={16} y={73} className="node-meta-text">
        Workers: {node.concurrency.maxWorkers} | Queue: {node.queue.mode}
      </text>

      {/* Left Input Port Indicator */}
      <circle cx={0} cy={45} r={4.5} className="port-dot-target" />

      {/* Right Output Connector Port Handle (drag-to-connect) */}
      <g
        className="node-port-handle"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect?.(node.id, e);
        }}
      >
        <title>Drag wire to connect to another service</title>
        <circle cx={180} cy={45} r={12} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={180} cy={45} r={6} className="port-dot-handle" />
      </g>
    </g>
  );
}
