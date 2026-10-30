import type { EdgeId, TopologyEdge, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';
import { computeEdgeRoute } from '../utils/edge-router';

export interface EdgeLinkProps {
  readonly edge: TopologyEdge;
  readonly sourceNode: BoardNode | undefined;
  readonly targetNode: BoardNode | undefined;
  readonly isSelected: boolean;
  readonly isHazard?: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: EdgeId) => void;
}

export function EdgeLink({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  isHazard,
  problems,
  onSelect,
}: EdgeLinkProps) {
  if (!sourceNode || !targetNode) return null;

  const { pathData, midX, midY } = computeEdgeRoute(
    sourceNode.position,
    targetNode.position,
    184,
    76,
  );

  const hasProblems = problems.some((p) => p.edgeId === edge.id);

  const policySummary = `${edge.policy.timeoutMs !== null ? `${String(edge.policy.timeoutMs)}ms` : 'no timeout'} · ${String(edge.policy.retry.maxAttempts)}x`;

  return (
    <g
      className={`canvas-edge ${isSelected ? 'canvas-edge-selected' : ''} ${
        hasProblems ? 'canvas-edge-error' : ''
      } ${isHazard ? 'canvas-edge-hazard' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
      aria-label={`Edge from ${edge.source} to ${edge.target}`}
    >
      {/* Invisible wider stroke for easy clicking */}
      <path d={pathData} className="edge-hitbox" />

      {/* Hazard Pulse Aura if flagged by SRE agent */}
      {isHazard && (
        <path
          d={pathData}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={5}
          strokeDasharray="6 4"
          className="edge-hazard-pulse"
        />
      )}

      {/* Visible Sleek Connecting Line */}
      <path
        d={pathData}
        className="edge-path"
        markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow)'}
      />

      {/* Breakscale Signature Flow: Subtle Live Network Packet Dot */}
      <circle r={2.5} className="edge-packet-dot">
        <animateMotion
          path={pathData}
          dur={
            edge.policy.timeoutMs !== null
              ? `${String(Math.max(1.5, edge.policy.timeoutMs / 300))}s`
              : '2.4s'
          }
          repeatCount="indefinite"
        />
      </circle>

      {/* Minimal Policy Capsule Tag */}
      <g transform={`translate(${String(midX - 44)}, ${String(midY - 10)})`}>
        <rect
          width={88}
          height={20}
          rx={10}
          className={`edge-tag-bg ${isHazard ? 'edge-tag-hazard' : ''}`}
        />
        <text x={44} y={13.5} className="edge-tag-text" textAnchor="middle">
          {policySummary}
        </text>
      </g>
    </g>
  );
}
