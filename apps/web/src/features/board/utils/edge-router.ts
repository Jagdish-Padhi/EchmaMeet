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
  sourceSide?: 'top' | 'right' | 'bottom' | 'left',
  targetSide?: 'top' | 'right' | 'bottom' | 'left',
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

  // Resolve sourceSide and targetSide: if not specified, determine from geometric relative position
  let resolvedSourceSide: 'top' | 'right' | 'bottom' | 'left';
  let resolvedTargetSide: 'top' | 'right' | 'bottom' | 'left';

  if (sourceSide && targetSide) {
    resolvedSourceSide = sourceSide;
    resolvedTargetSide = targetSide;
  } else if (sourceSide && !targetSide) {
    resolvedSourceSide = sourceSide;
    if (sourceSide === 'left') {
      resolvedTargetSide = dx < -20 ? 'right' : dy < 0 ? 'bottom' : 'top';
    } else if (sourceSide === 'right') {
      resolvedTargetSide = dx > 20 ? 'left' : dy < 0 ? 'bottom' : 'top';
    } else if (sourceSide === 'top') {
      resolvedTargetSide = dy < -20 ? 'bottom' : dx < 0 ? 'right' : 'left';
    } else {
      resolvedTargetSide = dy > 20 ? 'top' : dx < 0 ? 'right' : 'left';
    }
  } else if (!sourceSide && targetSide) {
    resolvedTargetSide = targetSide;
    if (targetSide === 'left') {
      resolvedSourceSide = dx > 20 ? 'right' : dy < 0 ? 'bottom' : 'top';
    } else if (targetSide === 'right') {
      resolvedSourceSide = dx < -20 ? 'left' : dy < 0 ? 'bottom' : 'top';
    } else if (targetSide === 'top') {
      resolvedSourceSide = dy > 20 ? 'bottom' : dx > 0 ? 'right' : 'left';
    } else {
      resolvedSourceSide = dy < -20 ? 'top' : dx > 0 ? 'right' : 'left';
    }
  } else {
    // Smart geometric flow when neither side is explicit
    if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
      if (dx >= 0) {
        resolvedSourceSide = 'right';
        resolvedTargetSide = 'left';
      } else {
        resolvedSourceSide = 'left';
        resolvedTargetSide = 'right';
      }
    } else {
      if (dy >= 0) {
        resolvedSourceSide = 'bottom';
        resolvedTargetSide = 'top';
      } else {
        resolvedSourceSide = 'top';
        resolvedTargetSide = 'bottom';
      }
    }
  }

  // Exact anchored port coordinates on node perimeters (strictly immutable by controlPoint)
  let sourcePort: Point;
  switch (resolvedSourceSide) {
    case 'top':
      sourcePort = {
        x: Number((scx + bidirectionalOffset * 0.45).toFixed(1)),
        y: Number(sTop.toFixed(1)),
      };
      break;
    case 'bottom':
      sourcePort = {
        x: Number((scx + bidirectionalOffset * 0.45).toFixed(1)),
        y: Number(sBottom.toFixed(1)),
      };
      break;
    case 'left':
      sourcePort = {
        x: Number(sLeft.toFixed(1)),
        y: Number((scy + bidirectionalOffset * 0.45).toFixed(1)),
      };
      break;
    case 'right':
    default:
      sourcePort = {
        x: Number(sRight.toFixed(1)),
        y: Number((scy + bidirectionalOffset * 0.45).toFixed(1)),
      };
      break;
  }

  let targetPort: Point;
  switch (resolvedTargetSide) {
    case 'top':
      targetPort = {
        x: Number((tcx + bidirectionalOffset * 0.45).toFixed(1)),
        y: Number(tTop.toFixed(1)),
      };
      break;
    case 'bottom':
      targetPort = {
        x: Number((tcx + bidirectionalOffset * 0.45).toFixed(1)),
        y: Number(tBottom.toFixed(1)),
      };
      break;
    case 'left':
      targetPort = {
        x: Number(tLeft.toFixed(1)),
        y: Number((tcy + bidirectionalOffset * 0.45).toFixed(1)),
      };
      break;
    case 'right':
    default:
      targetPort = {
        x: Number(tRight.toFixed(1)),
        y: Number((tcy + bidirectionalOffset * 0.45).toFixed(1)),
      };
      break;
  }

  const isSourceHorizontal = resolvedSourceSide === 'left' || resolvedSourceSide === 'right';
  const isTargetHorizontal = resolvedTargetSide === 'left' || resolvedTargetSide === 'right';
  const rawPoints: Point[] = [];

  // Branch 1: Horizontal Exit -> Vertical Entry (e.g. Left/Right of Source to Bottom/Top of Target)
  if (isSourceHorizontal && !isTargetHorizontal) {
    const isDirectX =
      (resolvedSourceSide === 'left' && targetPort.x < sourcePort.x) ||
      (resolvedSourceSide === 'right' && targetPort.x > sourcePort.x);

    if (isDirectX && !controlPoint) {
      // Clean single-corner L bend straight from source port to target port
      rawPoints.push(sourcePort, { x: targetPort.x, y: sourcePort.y }, targetPort);
    } else {
      const defaultCorridorX = Number(
        (sourcePort.x + (targetPort.x - sourcePort.x) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number' && Number.isFinite(controlPoint.x)
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;
      const defaultCorridorY =
        resolvedTargetSide === 'bottom' ? Math.max(sBottom, tBottom) + 36 : Math.min(sTop, tTop) - 36;
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number' && Number.isFinite(controlPoint.y)
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;

      rawPoints.push(
        sourcePort,
        { x: corridorX, y: sourcePort.y },
        { x: corridorX, y: corridorY },
        { x: targetPort.x, y: corridorY },
        targetPort,
      );
    }
  }
  // Branch 2: Vertical Exit -> Horizontal Entry (e.g. Bottom/Top of Source to Left/Right of Target)
  else if (!isSourceHorizontal && isTargetHorizontal) {
    const isDirectY =
      (resolvedSourceSide === 'top' && targetPort.y < sourcePort.y) ||
      (resolvedSourceSide === 'bottom' && targetPort.y > sourcePort.y);

    if (isDirectY && !controlPoint) {
      // Clean single-corner L bend straight from source port to target port
      rawPoints.push(sourcePort, { x: sourcePort.x, y: targetPort.y }, targetPort);
    } else {
      const defaultCorridorY = Number(
        (sourcePort.y + (targetPort.y - sourcePort.y) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number' && Number.isFinite(controlPoint.y)
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;
      const defaultCorridorX =
        resolvedTargetSide === 'right' ? Math.max(sRight, tRight) + 36 : Math.min(sLeft, tLeft) - 36;
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number' && Number.isFinite(controlPoint.x)
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;

      rawPoints.push(
        sourcePort,
        { x: sourcePort.x, y: corridorY },
        { x: corridorX, y: corridorY },
        { x: corridorX, y: targetPort.y },
        targetPort,
      );
    }
  }
  // Branch 3: Vertical Exit -> Vertical Entry (e.g. Bottom of Source to Top of Target)
  else if (!isSourceHorizontal && !isTargetHorizontal) {
    const isFlowForward =
      (resolvedSourceSide === 'bottom' && targetPort.y >= sourcePort.y) ||
      (resolvedSourceSide === 'top' && targetPort.y <= sourcePort.y);

    if (isFlowForward) {
      const defaultCorridorY = Number(
        (sourcePort.y + (targetPort.y - sourcePort.y) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number' && Number.isFinite(controlPoint.y)
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;

      if (Math.abs(targetPort.x - sourcePort.x) < 4 && !controlPoint) {
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
      // Loop around side
      const defaultCorridorX = Math.max(sRight, tRight) + 36 + bidirectionalOffset * 0.5;
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number' && Number.isFinite(controlPoint.x)
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;
      const outY = resolvedSourceSide === 'top' ? sTop - 28 : sBottom + 28;
      const inY = resolvedTargetSide === 'top' ? tTop - 28 : tBottom + 28;

      rawPoints.push(
        sourcePort,
        { x: sourcePort.x, y: outY },
        { x: corridorX, y: outY },
        { x: corridorX, y: inY },
        { x: targetPort.x, y: inY },
        targetPort,
      );
    }
  }
  // Branch 4: Horizontal Exit -> Horizontal Entry (e.g. Right of Source to Left of Target)
  else {
    const isFlowForward =
      (resolvedSourceSide === 'right' && targetPort.x >= sourcePort.x) ||
      (resolvedSourceSide === 'left' && targetPort.x <= sourcePort.x);

    if (isFlowForward) {
      const defaultCorridorX = Number(
        (sourcePort.x + (targetPort.x - sourcePort.x) / 2 + bidirectionalOffset * 0.5).toFixed(1),
      );
      const corridorX =
        controlPoint && typeof controlPoint.x === 'number' && Number.isFinite(controlPoint.x)
          ? Number(controlPoint.x.toFixed(1))
          : defaultCorridorX;

      if (Math.abs(targetPort.y - sourcePort.y) < 4 && !controlPoint) {
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
      // Loop under / over
      const defaultCorridorY = Math.max(sBottom, tBottom) + 36 + bidirectionalOffset * 0.5;
      const corridorY =
        controlPoint && typeof controlPoint.y === 'number' && Number.isFinite(controlPoint.y)
          ? Number(controlPoint.y.toFixed(1))
          : defaultCorridorY;
      const outX = resolvedSourceSide === 'left' ? sLeft - 28 : sRight + 28;
      const inX = resolvedTargetSide === 'left' ? tLeft - 28 : tRight + 28;

      rawPoints.push(
        sourcePort,
        { x: outX, y: sourcePort.y },
        { x: outX, y: corridorY },
        { x: inX, y: corridorY },
        { x: inX, y: targetPort.y },
        targetPort,
      );
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

  // Excalidraw-Grade multi-segment sliding handles:
  // Every segment with length >= 10 receives a responsive sliding handle
  const segments: RouteSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;
    const lenX = Math.abs(end.x - start.x);
    const lenY = Math.abs(end.y - start.y);
    if (lenX < 8 && lenY < 8) continue;

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

  const middleSegment = segments[Math.floor(segments.length / 2)] ?? segments[0];
  const midX = middleSegment
    ? middleSegment.handle.x
    : Number(((sourcePort.x + targetPort.x) / 2).toFixed(1));
  const midY = middleSegment
    ? middleSegment.handle.y
    : Number(((sourcePort.y + targetPort.y) / 2).toFixed(1));

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
 * Can optionally accept a specific start port (top, bottom, left, right).
 */
export function computeRubberbandRoute(
  source: Point,
  cursor: Point,
  nodeWidth = 184,
  nodeHeight = 76,
  startPort?: 'top' | 'right' | 'bottom' | 'left',
): string {
  let sx: number;
  let sy: number;

  switch (startPort) {
    case 'top':
      sx = source.x + nodeWidth / 2;
      sy = source.y;
      break;
    case 'bottom':
      sx = source.x + nodeWidth / 2;
      sy = source.y + nodeHeight;
      break;
    case 'left':
      sx = source.x;
      sy = source.y + nodeHeight / 2;
      break;
    case 'right':
    default:
      sx = source.x + nodeWidth;
      sy = source.y + nodeHeight / 2;
      break;
  }

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
