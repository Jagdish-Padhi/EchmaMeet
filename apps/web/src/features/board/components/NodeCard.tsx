import { memo, type MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export interface NodeCardProps {
  readonly node: BoardNode;
  readonly isSelected: boolean;
  readonly isEntry: boolean;
  readonly isHazard?: boolean;
  readonly isConnecting?: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: NodeId) => void;
  readonly onDragStart: (id: NodeId, e: ReactMouseEvent<SVGGElement>) => void;
  readonly onStartConnect?: (sourceId: NodeId, e: ReactMouseEvent<SVGElement>) => void;
  readonly onDropConnect?: (targetId: NodeId) => void;
}

export const NodeCard = memo(function NodeCard({
  node,
  isSelected,
  isEntry,
  isHazard,
  isConnecting,
  problems,
  onSelect,
  onDragStart,
  onStartConnect,
  onDropConnect,
}: NodeCardProps) {
  const hasProblems = problems.some((p) => p.nodeId === node.id);

  const getKindDetails = (kind: string) => {
    switch (kind) {
      case 'cache':
        return {
          color: '#f59e0b',
          bgTint: 'rgba(245, 158, 11, 0.12)',
          icon: (
            <path
              d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        };
      case 'queue_consumer':
        return {
          color: '#3b82f6',
          bgTint: 'rgba(37, 99, 235, 0.12)',
          icon: (
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        };
      case 'ledger_sink':
        return {
          color: '#10b981',
          bgTint: 'rgba(16, 185, 129, 0.12)',
          icon: (
            <path
              d="M4 6c0-1.657 3.582-3 8-3s8 1.343 8 3m-16 0v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6m-16 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        };
      case 'service':
      default:
        return {
          color: '#38bdf8',
          bgTint: 'rgba(56, 189, 248, 0.12)',
          icon: (
            <path
              d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm0 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        };
    }
  };

  const kindDetails = getKindDetails(node.kind);
  const latencyText =
    node.processing.distribution === 'constant'
      ? `${String(node.processing.ms)}ms`
      : `${String(node.processing.medianMs)}ms`;
  const dedupeSuffix = node.kind === 'ledger_sink' && node.dedupeByKey ? ' · dedupe:true' : '';
  const specSummary = `${String(node.concurrency.maxWorkers)}w · ${latencyText} · ${node.queue.mode}${dedupeSuffix}`;

  let subtitleText = node.kind.replace('_', ' ').toUpperCase();
  let subtitleColor = kindDetails.color;

  if (node.kind === 'queue_consumer') {
    subtitleText = 'QUEUE WORKER';
  } else if (node.kind === 'ledger_sink') {
    subtitleText = 'LEDGER SINK';
    subtitleColor = '#10b981';
  }

  if (isHazard) {
    subtitleText = `${subtitleText} • HAZARD`;
    subtitleColor = '#f59e0b';
  } else if (isEntry) {
    subtitleText = `${subtitleText} • ENTRY`;
    subtitleColor = '#0082fb';
  }

  const isSink = node.kind === 'ledger_sink';

  return (
    <g
      className={`canvas-node ${isSelected ? 'canvas-node-selected' : ''} ${
        hasProblems ? 'canvas-node-error' : ''
      } ${isHazard ? 'canvas-node-hazard' : ''} ${isEntry ? 'canvas-node-entry' : ''} ${
        isSink ? 'canvas-node-sink' : ''
      }`}
      style={{ outline: 'none' }}
      transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
      onClick={(e) => {
        e.stopPropagation();
        if (isConnecting) {
          onDropConnect?.(node.id);
        } else {
          onSelect(node.id);
        }
      }}
      onMouseDown={(e) => {
        if (!isConnecting) {
          onDragStart(node.id, e);
        }
      }}
      onMouseUp={() => {
        if (isConnecting) {
          onDropConnect?.(node.id);
        }
      }}
      aria-label={`Node ${node.label} (${node.kind})`}
    >
      {/* Main Sleek Card Body */}
      <rect width={184} height={76} rx={8} className="node-box" />

      {/* Left Icon Rounded Backdrop */}
      <rect x={12} y={12} width={28} height={28} rx={6} fill={kindDetails.bgTint} />

      {/* Kind SVG Icon */}
      <g transform="translate(14, 14) scale(1)">
        <svg width="24" height="24" viewBox="0 0 24 24">
          {kindDetails.icon}
        </svg>
      </g>

      {/* Node Label */}
      <text x={48} y={26} className="node-title">
        {node.label}
      </text>

      {/* Kind Subtitle */}
      <text x={48} y={38} className="node-kind-text" fill={subtitleColor}>
        {subtitleText}
      </text>

      {/* Problem Alert Dot */}
      {hasProblems && (
        <circle cx={170} cy={16} r={4} fill="#f43f5e" className="error-alert-dot">
          <title>Validation warning on this node</title>
        </circle>
      )}

      {/* Bottom Technical Spec Pill */}
      <line
        x1={12}
        y1={50}
        x2={172}
        y2={50}
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={1}
        className="node-divider"
      />
      <text x={14} y={64} className="node-meta-text">
        {specSummary}
      </text>

      {/* Target Input Port (Left Edge) */}
      <circle cx={0} cy={38} r={4} className="port-dot-target" />

      {/* Source Output Connector Handle (Right Edge, Drag-to-connect or Click-to-connect) */}
      <g
        className="node-port-handle"
        onClick={(e) => {
          e.stopPropagation();
          onStartConnect?.(node.id, e);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect?.(node.id, e);
        }}
      >
        <title>Click or drag to connect downstream service</title>
        <circle cx={184} cy={38} r={16} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={184} cy={38} r={4.5} className="port-dot-handle" />
      </g>
    </g>
  );
});
