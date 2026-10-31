/**
 * Excalidraw-grade rock-solid orthogonal edge router with rounded corners and multi-segment handles.
 * Connects node boundaries with clean 90-degree stepped bends, smooth corner radii,
 * automatic bidirectional non-overlapping separation, and stable interactive segment sliding.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RouteSegment {
  readonly index: number;
  readonly isVertical: boolean;
  readonly start: Point;
  readonly end: Point;
  readonly handle: Point;
}

export interface EdgeRouteResult {
  readonly pathData: string;
  readonly sourcePort: Point;
  readonly targetPort: Point;
  readonly midX: number;
  readonly midY: number;
  readonly points: readonly Point[];
  readonly segments: readonly RouteSegment[];
  readonly controlPoint: Point;
}

const CORNER_RADIUS = 10;

/**
 * Renders an arbitrary orthogonal polyline into an SVG path with smooth quadratic rounded corners.
 */
export function renderRoundedOrthogonalPath(
  points: readonly Point[],
  cornerRadius = CORNER_RADIUS,
): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  if (points.length === 2) {
    const second = points[1];
    if (!second) return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
    return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} L ${second.x.toFixed(1)} ${second.y.toFixed(1)}`;
  }

  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    if (!prev || !curr || !next) continue;

    const vinX = curr.x - prev.x;
    const vinY = curr.y - prev.y;
    const voutX = next.x - curr.x;
    const voutY = next.y - curr.y;

    const lenIn = Math.hypot(vinX, vinY);
    const lenOut = Math.hypot(voutX, voutY);

    if (lenIn < 1 || lenOut < 1) {
      continue;
    }

    const r = Math.min(cornerRadius, lenIn / 2, lenOut / 2);

    const inRatio = r / lenIn;
    const enterX = curr.x - vinX * inRatio;
    const enterY = curr.y - vinY * inRatio;

    const outRatio = r / lenOut;
    const exitX = curr.x + voutX * outRatio;
    const exitY = curr.y + voutY * outRatio;

    d += ` L ${enterX.toFixed(1)} ${enterY.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${exitX.toFixed(1)} ${exitY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  if (last) {
    d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  }

  return d;
}

export function computeEdgeRoute(
  source: Point,
  target: Point,
  nodeWidth = 184,
  nodeHeight = 76,
  controlPoint?: Point | null,
  bidirectionalOffset = 0,
): EdgeRouteResult {
  const sLeft = source.x;
  const sRight = source.x + nodeWidth;
  const sTop = source.y;
  const sBottom = source.y + nodeHeight;
  const scx = source.x + nodeWidth / 2;
  const scy = source.y + nodeHeight / 2;

  const tLeft = target.x;
  const tRight = target.x + nodeWidth;
  const tTop = target.y;
  const tBottom = target.y + nodeHeight;
  const tcx = target.x + nodeWidth / 2;
  const tcy = target.y + nodeHeight / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  let sourcePort: Point;
  let targetPort: Point;
  const rawPoints: Point[] = [];

  const isHorizontalFlow = Math.abs(dx) >= Math.abs(dy) * 0.85;

  if (isHorizontalFlow) {
    // Horizontal Flow (East or West)
    if (dx >= 0) {
      // East (Target is to the right)
      const sy = Number((scy + bidirectionalOffset * 0.45).toFixed(1));
      const ty = Number((tcy + bidirectionalOffset * 0.45).toFixed(1));
      sourcePort = { x: Number(sRight.toFixed(1)), y: sy };
      targetPort = { x: Number(tLeft.toFixed(1)), y: ty };

      const defaultCorridorX = Number(
        (sourcePort.x + (targetPort.x - sourcePort.x) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number'
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;

      if (Math.abs(ty - sy) < 4 && !controlPoint) {
        rawPoints.push(sourcePort, targetPort);
      } else {
        rawPoints.push(
          sourcePort,
          { x: corridorX, y: sourcePort.y },
          { x: corridorX, y: targetPort.y },
          targetPort,
        );
      }
    } else {
      // West (Target is to the left)
      const sy = Number((scy + bidirectionalOffset * 0.45).toFixed(1));
      const ty = Number((tcy + bidirectionalOffset * 0.45).toFixed(1));
      sourcePort = { x: Number(sLeft.toFixed(1)), y: sy };
      targetPort = { x: Number(tRight.toFixed(1)), y: ty };

      const defaultCorridorX = Number(
        (sourcePort.x + (targetPort.x - sourcePort.x) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number'
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;

      if (Math.abs(ty - sy) < 4 && !controlPoint) {
        rawPoints.push(sourcePort, targetPort);
      } else {
        rawPoints.push(
          sourcePort,
          { x: corridorX, y: sourcePort.y },
          { x: corridorX, y: targetPort.y },
          targetPort,
        );
      }
    }
  } else {
    // Vertical Flow (South or North)
    if (dy >= 0) {
      // South (Target is below)
      const sx = Number((scx + bidirectionalOffset * 0.45).toFixed(1));
      const tx = Number((tcx + bidirectionalOffset * 0.45).toFixed(1));
      sourcePort = { x: sx, y: Number(sBottom.toFixed(1)) };
      targetPort = { x: tx, y: Number(tTop.toFixed(1)) };

      const defaultCorridorY = Number(
        (sourcePort.y + (targetPort.y - sourcePort.y) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number'
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;

      if (Math.abs(tx - sx) < 4 && !controlPoint) {
        rawPoints.push(sourcePort, targetPort);
      } else {
        rawPoints.push(
          sourcePort,
          { x: sourcePort.x, y: corridorY },
          { x: targetPort.x, y: corridorY },
          targetPort,
        );
      }
    } else {
      // North (Target is above)
      const sx = Number((scx + bidirectionalOffset * 0.45).toFixed(1));
      const tx = Number((tcx + bidirectionalOffset * 0.45).toFixed(1));
      sourcePort = { x: sx, y: Number(sTop.toFixed(1)) };
      targetPort = { x: tx, y: Number(tBottom.toFixed(1)) };

      const defaultCorridorY = Number(
        (sourcePort.y + (targetPort.y - sourcePort.y) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number'
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;

      if (Math.abs(tx - sx) < 4 && !controlPoint) {
        rawPoints.push(sourcePort, targetPort);
      } else {
        rawPoints.push(
          sourcePort,
          { x: sourcePort.x, y: corridorY },
          { x: targetPort.x, y: corridorY },
          targetPort,
        );
      }
    }
  }

  // Deduplicate consecutive identical points
  const points: Point[] = [];
  for (const pt of rawPoints) {
    const last = points[points.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.5) {
      points.push({ x: Number(pt.x.toFixed(1)), y: Number(pt.y.toFixed(1)) });
    }
  }

  // Build segments directly from the rendered points:
  // For straight line (2 points), 1 handle at midpoint
  // For stepped orthogonal lines (4 points = 3 segments), only the movable interior corridor segment has a handle.
  const segments: RouteSegment[] = [];
  if (points.length === 2) {
    const start = points[0];
    const end = points[1];
    if (start && end) {
      const isVertical = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
      segments.push({
        index: 0,
        isVertical,
        start,
        end,
        handle: {
          x: Number(((start.x + end.x) / 2).toFixed(1)),
          y: Number(((start.y + end.y) / 2).toFixed(1)),
        },
      });
    }
  } else {
    for (let i = 1; i < points.length - 2; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) continue;
      const lenX = Math.abs(end.x - start.x);
      const lenY = Math.abs(end.y - start.y);
      if (lenX < 1 && lenY < 1) continue;

      const isVertical = lenY >= lenX;
      segments.push({
        index: i,
        isVertical,
        start,
        end,
        handle: {
          x: Number(((start.x + end.x) / 2).toFixed(1)),
          y: Number(((start.y + end.y) / 2).toFixed(1)),
        },
      });
    }
  }

  const middleSegment = segments[Math.floor(segments.length / 2)] ?? segments[0];
  const midX = middleSegment ? middleSegment.handle.x : Number(((sourcePort.x + targetPort.x) / 2).toFixed(1));
  const midY = middleSegment ? middleSegment.handle.y : Number(((sourcePort.y + targetPort.y) / 2).toFixed(1));

  const pathData = renderRoundedOrthogonalPath(points, CORNER_RADIUS);

  return {
    pathData,
    sourcePort,
    targetPort,
    midX,
    midY,
    points,
    segments,
    controlPoint: controlPoint ?? { x: midX, y: midY },
  };
}

/**
 * Rubberband wire route from source to moving cursor with rounded orthogonal bend.
 */
export function computeRubberbandRoute(
  source: Point,
  cursor: Point,
  nodeWidth = 184,
  nodeHeight = 76,
): string {
  const sx = source.x + nodeWidth;
  const sy = source.y + nodeHeight / 2;

  const mx = sx + (cursor.x - sx) / 2;
  const deltaY = cursor.y - sy;
  const r = Math.min(CORNER_RADIUS, Math.abs(deltaY) / 2, Math.abs(cursor.x - sx) / 2);

  if (cursor.x > sx + 10 && Math.abs(deltaY) > 8) {
    if (deltaY > 0) {
      return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx - r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy + r).toFixed(1)} L ${mx.toFixed(1)} ${(cursor.y - r).toFixed(1)} Q ${mx.toFixed(1)} ${cursor.y.toFixed(1)}, ${(mx + r).toFixed(1)} ${cursor.y.toFixed(1)} L ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
    }
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx - r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy - r).toFixed(1)} L ${mx.toFixed(1)} ${(cursor.y + r).toFixed(1)} Q ${mx.toFixed(1)} ${cursor.y.toFixed(1)}, ${(mx - r).toFixed(1)} ${cursor.y.toFixed(1)} L ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
  }
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
}
