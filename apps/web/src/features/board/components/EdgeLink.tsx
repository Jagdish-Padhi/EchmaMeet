import type { EdgeId, TopologyEdge, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export interface EdgeLinkProps {
  readonly edge: TopologyEdge;
  readonly sourceNode: BoardNode | undefined;
  readonly targetNode: BoardNode | undefined;
  readonly isSelected: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly onSelect: (id: EdgeId) => void;
}

export function EdgeLink({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  problems,
  onSelect,
}: EdgeLinkProps) {
  if (!sourceNode || !targetNode) return null;

  // Node centers (nodes are 180x90)
  const sx = sourceNode.position.x + 180;
  const sy = sourceNode.position.y + 45;
  const tx = targetNode.position.x;
  const ty = targetNode.position.y + 45;

  const dx = tx - sx;
  const cx1 = sx + Math.max(40, dx / 2);
  const cy1 = sy;
  const cx2 = tx - Math.max(40, dx / 2);
  const cy2 = ty;

  const pathData = `M ${String(sx)} ${String(sy)} C ${String(cx1)} ${String(cy1)}, ${String(
    cx2,
  )} ${String(cy2)}, ${String(tx)} ${String(ty)}`;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2 - 12;

  const hasProblems = problems.some((p) => p.edgeId === edge.id);

  const policySummary = `${edge.policy.timeoutMs !== null ? `${String(edge.policy.timeoutMs)}ms` : 'no timeout'} | ${String(edge.policy.retry.maxAttempts)}x retry`;

  return (
    <g
      className={`canvas-edge ${isSelected ? 'canvas-edge-selected' : ''} ${
        hasProblems ? 'canvas-edge-error' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Edge from ${edge.source} to ${edge.target}`}
    >
      {/* Invisible wider stroke for easy clicking */}
      <path d={pathData} className="edge-hitbox" />

      {/* Visible line */}
      <path
        d={pathData}
        className="edge-path"
        markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow)'}
      />

      {/* Edge tag badge */}
      <g transform={`translate(${String(midX - 58)}, ${String(midY - 11)})`}>
        <rect width={116} height={22} rx={11} className="edge-tag-bg" />
        <text x={58} y={15} className="edge-tag-text" textAnchor="middle">
          {policySummary}
        </text>
      </g>
    </g>
  );
}
