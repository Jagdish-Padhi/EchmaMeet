import { memo } from 'react';
import type { EdgeId, TopologyEdge, TopologyProblem } from '@chaosboard/contracts';
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
  readonly onSelect: (id: EdgeId) => void;
  readonly onDragControlPointStart?: (
    id: EdgeId,
    e: React.MouseEvent,
    isVertical: boolean,
    segmentIndex: number,
    handlePoint: Point,
  ) => void;
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
  onSelect,
  onDragControlPointStart,
  onResetControlPoint,
}: EdgeLinkProps) {
  if (!sourceNode || !targetNode) return null;

  const { pathData, midX, midY, segments } = computeEdgeRoute(
    sourceNode.position,
    targetNode.position,
    184,
    76,
    controlPoint,
    bidirectionalOffset,
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

      {/* Hazard Pulse Aura if flagged by SRE agent */}
      {isHazard && (
        <path
          d={pathData}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={5}
          strokeDasharray="6 4"
          className="edge-hazard-pulse"
          style={{ outline: 'none' }}
        />
      )}

      {/* Visible Sleek Connecting Line */}
      <path
        d={pathData}
        className="edge-path"
        style={{ outline: 'none' }}
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

      {/* Excalidraw-Grade Subtle Segment Handles (Small, Mild & Non-Intrusive) */}
      {isSelected &&
        segments.map((seg) => {
          // If handle collides with policy tag capsule, suppress it so text remains clean and unobstructed
          const isOverCapsule =
            policySummary && Math.hypot(seg.handle.x - midX, seg.handle.y - midY) < 24;
          if (isOverCapsule) return null;

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
              {/* Invisible wide hit area for effortless grabbing */}
              <circle cx={seg.handle.x} cy={seg.handle.y} r={14} fill="transparent" />
              {/* Mild, small precision handle dot */}
              <circle
                cx={seg.handle.x}
                cy={seg.handle.y}
                r={3}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={1.2}
                className="edge-segment-handle-dot"
              />
              <title>
                {seg.isVertical
                  ? 'Slide vertical line horizontally (Double-click to reset)'
                  : 'Slide horizontal line vertically (Double-click to reset)'}
              </title>
            </g>
          );
        })}

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
