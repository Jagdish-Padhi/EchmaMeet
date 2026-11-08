import { memo } from 'react';
import type { EdgeId, NodeId, TopologyEdge, TopologyProblem } from '@chaosboard/contracts';
import type { BoardNode } from '../types';
import { computeEdgeRoute, type Point } from '../utils/edge-router';

export interface EdgeLinkProps {
  readonly edge: TopologyEdge;
  readonly sourceNode: BoardNode | undefined;
  readonly targetNode: BoardNode | undefined;
  readonly isSelected: boolean;
  readonly isHazard?: boolean;
  readonly problems: readonly TopologyProblem[];
  readonly controlPoint?: Point | null;
  readonly bidirectionalOffset?: number;
  readonly sourceSide?: 'top' | 'right' | 'bottom' | 'left' | undefined;
  readonly targetSide?: 'top' | 'right' | 'bottom' | 'left' | undefined;
  readonly onSelect: (id: EdgeId) => void;
  readonly onDragControlPointStart?: (
    id: EdgeId,
    e: React.MouseEvent,
    isVertical: boolean,
    segmentIndex: number,
    handlePoint: Point,
  ) => void;
  readonly onStartReconnectSource?: (edgeId: EdgeId, targetId: NodeId, e: React.MouseEvent) => void;
  readonly onStartReconnectTarget?: (edgeId: EdgeId, sourceId: NodeId, e: React.MouseEvent) => void;
  readonly onResetControlPoint?: (id: EdgeId) => void;
}

function computePolicySummary(edge: TopologyEdge): string | null {
  const parts: string[] = [];

  if (edge.mode === 'async_enqueue') {
    parts.push('async');
  }

  if (edge.policy.timeoutMs !== null) {
    const ms = edge.policy.timeoutMs;
    const formatted = ms >= 1000 && ms % 1000 === 0 ? `${String(ms / 1000)}s` : `${String(ms)}ms`;
    parts.push(formatted);
  }

  if (edge.policy.retry.maxAttempts > 0) {
    parts.push(`${String(edge.policy.retry.maxAttempts)}x`);
  }

  if (edge.policy.breaker.enabled) {
    parts.push('CB');
  }

  if (edge.policy.fallback !== 'fail_fast_503') {
    parts.push(edge.policy.fallback === 'serve_stale_cache' ? 'stale' : 'queue');
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export const EdgeLink = memo(function EdgeLink({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  isHazard,
  problems,
  controlPoint,
  bidirectionalOffset = 0,
  sourceSide,
  targetSide,
  onSelect,
  onDragControlPointStart,
  onStartReconnectSource,
  onStartReconnectTarget,
  onResetControlPoint,
}: EdgeLinkProps) {
  if (!sourceNode || !targetNode) return null;

  const { pathData, midX, midY, segments, sourcePort, targetPort } = computeEdgeRoute(
    sourceNode.position,
    targetNode.position,
    184,
    76,
    controlPoint,
    bidirectionalOffset,
    sourceSide,
    targetSide,
  );

  const hasProblems = problems.some((p) => p.edgeId === edge.id);

  const policySummary = computePolicySummary(edge);
  const tagWidth = policySummary ? Math.max(38, policySummary.length * 6.2 + 12) : 0;

  return (
    <g
      className={`canvas-edge ${isSelected ? 'canvas-edge-selected' : ''} ${
        hasProblems ? 'canvas-edge-error' : ''
      } ${isHazard ? 'canvas-edge-hazard' : ''}`}
      style={{ outline: 'none' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
      aria-label={`Edge from ${edge.source} to ${edge.target}`}
    >
      {/* Invisible wider stroke for easy clicking */}
      <path d={pathData} className="edge-hitbox" style={{ outline: 'none' }} />

      {/* High-contrast Red Neon Blink Aura if flagged by SRE co-pilot */}
      {isHazard && (
        <path
          d={pathData}
          fill="none"
          stroke="#ff1744"
          strokeWidth={5}
          className="edge-hazard-neon-pulse"
          style={{ outline: 'none' }}
        />
      )}

      {/* Visible Sleek Connecting Line */}
      <path
        d={pathData}
        className={`edge-path ${isHazard ? 'edge-path-hazard' : ''}`}
        style={{ outline: 'none' }}
        markerEnd={
          isHazard
            ? 'url(#arrow-hazard)'
            : isSelected
              ? 'url(#arrow-selected)'
              : 'url(#arrow)'
        }
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

      {/* Excalidraw-Grade Sliding Corridors: Draggable along entire segment + Precision Handle Dot */}
      {segments.map((seg) => {
        // If handle center coincides with the policy tag capsule, offset the handle dot along the segment so it is NEVER suppressed
        const isNearCapsule =
          policySummary && Math.hypot(seg.handle.x - midX, seg.handle.y - midY) < 26;
        const dotX = isNearCapsule
          ? seg.isVertical
            ? seg.handle.x
            : seg.handle.x + (seg.start.x < seg.end.x ? 32 : -32)
          : seg.handle.x;
        const dotY = isNearCapsule
          ? !seg.isVertical
            ? seg.handle.y
            : seg.handle.y + (seg.start.y < seg.end.y ? 32 : -32)
          : seg.handle.y;

        return (
          <g
            key={`handle-${edge.id}-${String(seg.index)}`}
            className="edge-control-handle"
            style={{
              cursor: seg.isVertical ? 'ew-resize' : 'ns-resize',
              outline: 'none',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragControlPointStart?.(edge.id, e, seg.isVertical, seg.index, seg.handle);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onResetControlPoint?.(edge.id);
            }}
          >
            {/* Full invisible hitline along the entire segment for effortless, natural Excalidraw sliding */}
            <line
              x1={seg.start.x}
              y1={seg.start.y}
              x2={seg.end.x}
              y2={seg.end.y}
              stroke="transparent"
              strokeWidth={18}
            />
            {/* Invisible circular hitzone around handle */}
            <circle cx={dotX} cy={dotY} r={16} fill="transparent" />
            {/* Mild, small precision handle dot */}
            <circle
              cx={dotX}
              cy={dotY}
              r={2.5}
              fill="var(--color-accent)"
              stroke="var(--color-bg)"
              strokeWidth={1.2}
              className="edge-segment-handle-dot"
            />
            <title>
              {seg.isVertical
                ? 'Slide vertical corridor horizontally (Double-click to reset)'
                : 'Slide horizontal corridor vertically (Double-click to reset)'}
            </title>
          </g>
        );
      })}

      {/* Excalidraw-Grade Source Detach / Reconnect Port Handle (Visible on hover & selection) */}
      {onStartReconnectSource && (
        <g
          className="edge-arrow-reconnect-handle edge-source-reconnect-handle"
          style={{ cursor: 'grab', outline: 'none' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartReconnectSource(edge.id, edge.target, e);
          }}
        >
          <title>Hold and drag start point to reattach to any node or position</title>
          <circle cx={sourcePort.x} cy={sourcePort.y} r={16} fill="transparent" />
          <circle
            cx={sourcePort.x}
            cy={sourcePort.y}
            r={3.5}
            fill="#ffffff"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            className="arrow-reconnect-dot"
          />
        </g>
      )}

      {/* Excalidraw-Grade Arrowhead Detach / Reconnect Port Handle (Visible on hover & selection) */}
      {onStartReconnectTarget && (
        <g
          className="edge-arrow-reconnect-handle"
          style={{ cursor: 'grab', outline: 'none' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartReconnectTarget(edge.id, edge.source, e);
          }}
        >
          <title>Hold and drag arrowhead to slide and reattach to any node or position</title>
          {/* Generous 32px grab hitzone directly over arrow tip */}
          <circle cx={targetPort.x} cy={targetPort.y} r={16} fill="transparent" />
          <circle
            cx={targetPort.x}
            cy={targetPort.y}
            r={3.5}
            fill="#ffffff"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            className="arrow-reconnect-dot"
          />
        </g>
      )}

      {/* Sleek, Compact Policy Capsule Tag (Only when relevant policy exists) */}
      {policySummary && (
        <g
          transform={`translate(${String(Math.round(midX - tagWidth / 2))}, ${String(Math.round(midY - 8))})`}
          style={{ outline: 'none' }}
        >
          <rect
            width={Math.round(tagWidth)}
            height={16}
            rx={8}
            style={{ outline: 'none' }}
            className={`edge-tag-bg ${isHazard ? 'edge-tag-hazard' : ''}`}
          />
          <text x={Math.round(tagWidth / 2)} y={11.5} className="edge-tag-text" textAnchor="middle">
            {policySummary}
          </text>
        </g>
      )}
    </g>
  );
});
