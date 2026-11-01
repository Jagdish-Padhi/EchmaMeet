import { memo, type MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export type NodePortPosition = 'top' | 'right' | 'bottom' | 'left';

export interface NodeCardProps {
  readonly node: BoardNode;
  readonly nodeNumber?: number;
  readonly isSelected: boolean;
  readonly isMultiSelected?: boolean;
  readonly isEntry: boolean;
  readonly isHazard?: boolean;
  readonly isConnecting?: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: NodeId, e?: ReactMouseEvent) => void;
  readonly onDragStart: (id: NodeId, e: ReactMouseEvent<SVGGElement>) => void;
  readonly onStartConnect?: (
    sourceId: NodeId,
    e: ReactMouseEvent<SVGElement>,
    port?: NodePortPosition,
  ) => void;
  readonly onDropConnect?: (targetId: NodeId, port?: NodePortPosition) => void;
}

export const NodeCard = memo(function NodeCard({
  node,
  nodeNumber,
  isSelected,
  isMultiSelected,
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
      : `~${String(node.processing.medianMs)}ms`;
  const dedupeSuffix = node.kind === 'ledger_sink' && node.dedupeByKey ? ' · dedupe' : '';
  const rateLimitSuffix = node.ingressRateLimitRps
    ? ` · ${node.ingressRateLimitRps >= 1000 ? `${String(node.ingressRateLimitRps / 1000)}k` : String(node.ingressRateLimitRps)} rps`
    : '';
  const rawSpec = `${String(node.concurrency.maxWorkers)}w · ${latencyText} · ${node.queue.mode}${dedupeSuffix}${rateLimitSuffix}`;
  const specSummary = rawSpec.length > 34 ? `${rawSpec.slice(0, 33)}…` : rawSpec;

  // Clean minimal node number (1, 2, 3...) at top right corner - zero redundant badges
  const idDigits = /\d+/.exec(node.id);
  const displayNumber = nodeNumber ?? (idDigits ? parseInt(idDigits[0], 10) : 1);
  const numberText = String(displayNumber);
  const numberPillWidth = Math.max(16, numberText.length * 6.5 + 8);
  const numberPillX = 174 - numberPillWidth;

  const displayLabel = node.label.length > 17 ? `${node.label.slice(0, 16)}…` : node.label;

  let subtitleText = node.kind.replace('_', ' ').toUpperCase();
  let subtitleColor = kindDetails.color;

  if (node.kind === 'queue_consumer') {
    subtitleText = 'QUEUE CONSUMER';
  } else if (node.kind === 'ledger_sink') {
    subtitleText = 'LEDGER SINK';
    subtitleColor = '#10b981';
  }

  const isSink = node.kind === 'ledger_sink';

  return (
    <g
      className={`canvas-node ${isSelected ? 'canvas-node-selected' : ''} ${
        isMultiSelected && !isSelected ? 'canvas-node-multiselected' : ''
      } ${hasProblems ? 'canvas-node-error' : ''} ${isHazard ? 'canvas-node-hazard' : ''} ${
        isEntry ? 'canvas-node-entry' : ''
      } ${isSink ? 'canvas-node-sink' : ''}`}
      style={{ outline: 'none' }}
      transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
      onClick={(e) => {
        e.stopPropagation();
        if (isConnecting) {
          onDropConnect?.(node.id);
        } else {
          onSelect(node.id, e);
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
      <defs>
        <clipPath id={`node-clip-${node.id}`}>
          <rect width={184} height={76} rx={8} />
        </clipPath>
      </defs>

      {/* Main Single Card Body (Clean Breakscale-Grade Single Border) */}
      <rect width={184} height={76} rx={8} className="node-box" />

      {/* Clipped Card Interior Content */}
      <g clipPath={`url(#node-clip-${node.id})`}>
        {/* Left Icon Rounded Backdrop */}
        <rect x={10} y={10} width={26} height={26} rx={6} fill={kindDetails.bgTint} />

        {/* Kind SVG Icon */}
        <g transform="translate(11, 11) scale(0.95)">
          <svg width="24" height="24" viewBox="0 0 24 24">
            {kindDetails.icon}
          </svg>
        </g>

        {/* Node Label (Clean small crisp font with tooltip) */}
        <text x={44} y={23} className="node-title">
          <title>{node.label}</title>
          {displayLabel}
        </text>

        {/* Kind Subtitle */}
        <text x={44} y={35} className="node-kind-text" fill={subtitleColor}>
          {subtitleText}
        </text>

        {/* Clean minimal node number (1, 2, 3...) at top right corner */}
        <g transform={`translate(${String(numberPillX)}, 8)`} className="node-id-tag">
          <title>Node #{numberText}</title>
          <rect width={numberPillWidth} height={13} rx={3} className="node-id-pill" />
          <text
            x={numberPillWidth / 2}
            y={6.5}
            dominantBaseline="central"
            textAnchor="middle"
            className="node-id-text"
          >
            {numberText}
          </text>
        </g>

        {/* Problem Alert Dot */}
        {hasProblems && (
          <circle cx={numberPillX - 5} cy={14.5} r={2.5} fill="#f43f5e" className="error-alert-dot">
            <title>Validation warning on Node #{numberText}</title>
          </circle>
        )}

        {/* Bottom Technical Spec Line */}
        <line
          x1={10}
          y1={46}
          x2={174}
          y2={46}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={1}
          className="node-divider"
        />
        <text x={12} y={61} className="node-meta-text">
          <title>{rawSpec}</title>
          {specSummary}
        </text>
      </g>

      {/* 4 Interactive Edge Connection Ports (Top, Right, Bottom, Left centers) */}
      {/* Top Edge Port */}
      <g
        className="node-port-handle node-port-top"
        onClick={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'top');
          } else {
            onStartConnect?.(node.id, e, 'top');
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!isConnecting) {
            onStartConnect?.(node.id, e, 'top');
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'top');
          }
        }}
      >
        <title>{isConnecting ? 'Drop to connect to top edge' : 'Connect from top edge'}</title>
        <circle cx={92} cy={0} r={16} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={92} cy={0} r={2.5} className="port-dot-handle" />
      </g>

      {/* Right Edge Port */}
      <g
        className="node-port-handle node-port-right"
        onClick={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'right');
          } else {
            onStartConnect?.(node.id, e, 'right');
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!isConnecting) {
            onStartConnect?.(node.id, e, 'right');
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'right');
          }
        }}
      >
        <title>{isConnecting ? 'Drop to connect to right edge' : 'Connect from right edge'}</title>
        <circle cx={184} cy={38} r={16} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={184} cy={38} r={2.5} className="port-dot-handle" />
      </g>

      {/* Bottom Edge Port */}
      <g
        className="node-port-handle node-port-bottom"
        onClick={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'bottom');
          } else {
            onStartConnect?.(node.id, e, 'bottom');
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!isConnecting) {
            onStartConnect?.(node.id, e, 'bottom');
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'bottom');
          }
        }}
      >
        <title>{isConnecting ? 'Drop to connect to bottom edge' : 'Connect from bottom edge'}</title>
        <circle cx={92} cy={76} r={16} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={92} cy={76} r={2.5} className="port-dot-handle" />
      </g>

      {/* Left Edge Port */}
      <g
        className="node-port-handle node-port-left"
        onClick={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'left');
          } else {
            onStartConnect?.(node.id, e, 'left');
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!isConnecting) {
            onStartConnect?.(node.id, e, 'left');
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (isConnecting) {
            onDropConnect?.(node.id, 'left');
          }
        }}
      >
        <title>{isConnecting ? 'Drop to connect to left edge' : 'Connect from left edge'}</title>
        <circle cx={0} cy={38} r={16} fill="transparent" style={{ cursor: 'crosshair' }} />
        <circle cx={0} cy={38} r={2.5} className="port-dot-handle" />
      </g>
    </g>
  );
});
