/**
 * Intelligent orthogonal & smooth cubic bezier edge routing.
 * Automatically chooses optimal cardinal attachment ports (East, West, North, South)
 * between bounding boxes so connection arrows never bend awkwardly or intersect nodes.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface EdgeRouteResult {
  readonly pathData: string;
  readonly sourcePort: Point;
  readonly targetPort: Point;
  readonly midX: number;
  readonly midY: number;
}

export function computeEdgeRoute(
  source: Point,
  target: Point,
  nodeWidth = 184,
  nodeHeight = 76,
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
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  // Case 1: Target is primarily to the East (Right)
  if (dx >= nodeWidth * 0.4) {
    sx = source.x + nodeWidth;
    sy = source.y + nodeHeight / 2;
    tx = target.x;
    ty = target.y + nodeHeight / 2;

    const gapX = tx - sx;
    if (gapX >= 20) {
      const curve = Math.max(30, Math.min(120, gapX * 0.5));
      c1x = sx + curve;
      c1y = sy;
      c2x = tx - curve;
      c2y = ty;
    } else {
      // Overlapping horizontal range; curve around with generous offset
      const curve = 50;
      c1x = sx + curve;
      c1y = sy;
      c2x = tx - curve;
      c2y = ty;
    }
  }
  // Case 2: Target is primarily to the West (Left)
  else if (dx <= -nodeWidth * 0.4) {
    sx = source.x;
    sy = source.y + nodeHeight / 2;
    tx = target.x + nodeWidth;
    ty = target.y + nodeHeight / 2;

    const gapX = sx - tx;
    if (gapX >= 20) {
      const curve = Math.max(30, Math.min(120, gapX * 0.5));
      c1x = sx - curve;
      c1y = sy;
      c2x = tx + curve;
      c2y = ty;
    } else {
      const curve = 50;
      c1x = sx - curve;
      c1y = sy;
      c2x = tx + curve;
      c2y = ty;
    }
  }
  // Case 3: Target is primarily to the South (Below)
  else if (dy > 0) {
    sx = source.x + nodeWidth / 2;
    sy = source.y + nodeHeight;
    tx = target.x + nodeWidth / 2;
    ty = target.y;

    const gapY = Math.max(20, ty - sy);
    const curve = Math.max(25, Math.min(100, gapY * 0.5));
    c1x = sx;
    c1y = sy + curve;
    c2x = tx;
    c2y = ty - curve;
  }
  // Case 4: Target is primarily to the North (Above)
  else {
    sx = source.x + nodeWidth / 2;
    sy = source.y;
    tx = target.x + nodeWidth / 2;
    ty = target.y + nodeHeight;

    const gapY = Math.max(20, sy - ty);
    const curve = Math.max(25, Math.min(100, gapY * 0.5));
    c1x = sx;
    c1y = sy - curve;
    c2x = tx;
    c2y = ty + curve;
  }

  const pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;

  // Parametric midpoint of cubic bezier at t = 0.5: B(0.5) = 0.125 P0 + 0.375 P1 + 0.375 P2 + 0.125 P3
  const midX = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
  const midY = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty;

  return {
    pathData,
    sourcePort: { x: sx, y: sy },
    targetPort: { x: tx, y: ty },
    midX: Number(midX.toFixed(1)),
    midY: Number(midY.toFixed(1)),
  };
}

/**
 * Rubberband wire route from a source node to a moving cursor point.
 */
export function computeRubberbandRoute(
  source: Point,
  cursor: Point,
  nodeWidth = 184,
  nodeHeight = 76,
): string {
  const scx = source.x + nodeWidth / 2;
  const scy = source.y + nodeHeight / 2;
  const dx = cursor.x - scx;
  const dy = cursor.y - scy;

  let sx: number;
  let sy: number;
  let c1x: number;
  let c1y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      sx = source.x + nodeWidth;
      sy = source.y + nodeHeight / 2;
      c1x = sx + Math.max(30, Math.min(80, dx * 0.4));
      c1y = sy;
    } else {
      sx = source.x;
      sy = source.y + nodeHeight / 2;
      c1x = sx - Math.max(30, Math.min(80, Math.abs(dx) * 0.4));
      c1y = sy;
    }
  } else {
    if (dy >= 0) {
      sx = source.x + nodeWidth / 2;
      sy = source.y + nodeHeight;
      c1x = sx;
      c1y = sy + Math.max(25, Math.min(70, dy * 0.4));
    } else {
      sx = source.x + nodeWidth / 2;
      sy = source.y;
      c1x = sx;
      c1y = sy - Math.max(25, Math.min(70, Math.abs(dy) * 0.4));
    }
  }

  const c2x = cursor.x - (cursor.x - c1x) * 0.3;
  const c2y = cursor.y;

  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${cursor.x.toFixed(1)} ${cursor.y.toFixed(1)}`;
}
