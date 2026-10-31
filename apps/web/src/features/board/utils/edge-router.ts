/**
 * Excalidraw-grade flexible orthogonal edge router with rounded corners and multi-segment handles.
 * Connects node ports with clean 90-degree stepped bends, smooth corner radii,
 * automatic bidirectional non-overlapping separation, and interactive segment sliding.
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

const CORNER_RADIUS = 12;

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
  const scx = source.x + nodeWidth / 2;
  const scy = source.y + nodeHeight / 2;
  const tcx = target.x + nodeWidth / 2;
  const tcy = target.y + nodeHeight / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;
  const rawPoints: Point[] = [];

  // Determine principal direction
  // Case 1: Target is primarily East (Right)
  if (dx >= nodeWidth * 0.4) {
    sx = source.x + nodeWidth;
    sy = source.y + nodeHeight / 2 + bidirectionalOffset * 0.45;
    tx = target.x;
    ty = target.y + nodeHeight / 2 + bidirectionalOffset * 0.45;

    const defaultCorridorX = sx + (tx - sx) / 2 + bidirectionalOffset * 0.5;
    const corridorX = controlPoint?.x ?? defaultCorridorX;

    if (controlPoint && typeof controlPoint.y === 'number') {
      const corridorY = controlPoint.y;
      rawPoints.push(
        { x: sx, y: sy },
        { x: corridorX, y: sy },
        { x: corridorX, y: corridorY },
        { x: tx, y: corridorY },
        { x: tx, y: ty },
      );
    } else {
      const deltaY = Math.abs(ty - sy);
      if (deltaY < 4 && !controlPoint) {
        rawPoints.push({ x: sx, y: sy }, { x: tx, y: ty });
      } else {
        rawPoints.push(
          { x: sx, y: sy },
          { x: corridorX, y: sy },
          { x: corridorX, y: ty },
          {
            x: tx,
            y: ty,
          },
        );
      }
    }
  }
  // Case 2: Target is primarily West (Left)
  else if (dx <= -nodeWidth * 0.4) {
    sx = source.x;
    sy = source.y + nodeHeight / 2 + bidirectionalOffset * 0.45;
    tx = target.x + nodeWidth;
    ty = target.y + nodeHeight / 2 + bidirectionalOffset * 0.45;

    const defaultCorridorX = sx + (tx - sx) / 2 + bidirectionalOffset * 0.5;
    const corridorX = controlPoint?.x ?? defaultCorridorX;

    if (controlPoint && typeof controlPoint.y === 'number') {
      const corridorY = controlPoint.y;
      rawPoints.push(
        { x: sx, y: sy },
        { x: corridorX, y: sy },
        { x: corridorX, y: corridorY },
        { x: tx, y: corridorY },
        { x: tx, y: ty },
      );
    } else {
      const deltaY = Math.abs(ty - sy);
      if (deltaY < 4 && !controlPoint) {
        rawPoints.push({ x: sx, y: sy }, { x: tx, y: ty });
      } else {
        rawPoints.push(
          { x: sx, y: sy },
          { x: corridorX, y: sy },
          { x: corridorX, y: ty },
          {
            x: tx,
            y: ty,
          },
        );
      }
    }
  }
  // Case 3: Target is primarily South (Below)
  else if (dy > 0) {
    sx = source.x + nodeWidth / 2 + bidirectionalOffset * 0.45;
    sy = source.y + nodeHeight;
    tx = target.x + nodeWidth / 2 + bidirectionalOffset * 0.45;
    ty = target.y;

    const defaultCorridorY = sy + (ty - sy) / 2 + bidirectionalOffset * 0.5;
    const corridorY = controlPoint?.y ?? defaultCorridorY;

    if (controlPoint && typeof controlPoint.x === 'number') {
      const corridorX = controlPoint.x;
      rawPoints.push(
        { x: sx, y: sy },
        { x: sx, y: corridorY },
        { x: corridorX, y: corridorY },
        { x: corridorX, y: ty },
        { x: tx, y: ty },
      );
    } else {
      const deltaX = Math.abs(tx - sx);
      if (deltaX < 4 && !controlPoint) {
        rawPoints.push({ x: sx, y: sy }, { x: tx, y: ty });
      } else {
        rawPoints.push(
          { x: sx, y: sy },
          { x: sx, y: corridorY },
          { x: tx, y: corridorY },
          {
            x: tx,
            y: ty,
          },
        );
      }
    }
  }
  // Case 4: Target is primarily North (Above)
  else {
    sx = source.x + nodeWidth / 2 + bidirectionalOffset * 0.45;
    sy = source.y;
    tx = target.x + nodeWidth / 2 + bidirectionalOffset * 0.45;
    ty = target.y + nodeHeight;

    const defaultCorridorY = sy + (ty - sy) / 2 + bidirectionalOffset * 0.5;
    const corridorY = controlPoint?.y ?? defaultCorridorY;

    if (controlPoint && typeof controlPoint.x === 'number') {
      const corridorX = controlPoint.x;
      rawPoints.push(
        { x: sx, y: sy },
        { x: sx, y: corridorY },
        { x: corridorX, y: corridorY },
        { x: corridorX, y: ty },
        { x: tx, y: ty },
      );
    } else {
      const deltaX = Math.abs(tx - sx);
      if (deltaX < 4 && !controlPoint) {
        rawPoints.push({ x: sx, y: sy }, { x: tx, y: ty });
      } else {
        rawPoints.push(
          { x: sx, y: sy },
          { x: sx, y: corridorY },
          { x: tx, y: corridorY },
          {
            x: tx,
            y: ty,
          },
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

  // Build segments with tactile mid-point handles
  const segments: RouteSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
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

  const middleSegment = segments[Math.floor(segments.length / 2)] ?? segments[0];
  const midX = middleSegment ? middleSegment.handle.x : Number(((sx + tx) / 2).toFixed(1));
  const midY = middleSegment ? middleSegment.handle.y : Number(((sy + ty) / 2).toFixed(1));

  const pathData = renderRoundedOrthogonalPath(points, CORNER_RADIUS);

  return {
    pathData,
    sourcePort: { x: Number(sx.toFixed(1)), y: Number(sy.toFixed(1)) },
    targetPort: { x: Number(tx.toFixed(1)), y: Number(ty.toFixed(1)) },
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
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx - r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy - r).toFixed(1)} L ${mx.toFixed(1)} ${(cursor.y + r).toFixed(1)} Q ${mx.toFixed(1)} ${cursor.y.toFixed(1)}, ${(mx + r).toFixed(1)} ${cursor.y.toFixed(1)} L ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
  }
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
}
