/**
 * Excalidraw-grade squared orthogonal edge router with sleek rounded corners.
 * Connects node ports with clean 90-degree stepped bends and smooth corner radii,
 * ensuring lines never cut diagonally across the canvas or pass through node boxes.
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

const CORNER_RADIUS = 14;

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
  let pathData: string;
  let midX: number;
  let midY: number;

  // Case 1: Target is primarily to the East (Right)
  if (dx >= nodeWidth * 0.4) {
    sx = source.x + nodeWidth;
    sy = source.y + nodeHeight / 2;
    tx = target.x;
    ty = target.y + nodeHeight / 2;

    const mx = sx + (tx - sx) / 2;
    midX = mx;
    midY = (sy + ty) / 2;

    const deltaY = ty - sy;
    if (Math.abs(deltaY) < 6) {
      pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    } else {
      const r = Math.min(CORNER_RADIUS, Math.abs(deltaY) / 2, Math.abs(tx - sx) / 2);
      if (deltaY > 0) {
        // Target is below: horizontal -> down -> horizontal
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx - r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy + r).toFixed(1)} L ${mx.toFixed(1)} ${(ty - r).toFixed(1)} Q ${mx.toFixed(1)} ${ty.toFixed(1)}, ${(mx + r).toFixed(1)} ${ty.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      } else {
        // Target is above: horizontal -> up -> horizontal
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx - r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy - r).toFixed(1)} L ${mx.toFixed(1)} ${(ty + r).toFixed(1)} Q ${mx.toFixed(1)} ${ty.toFixed(1)}, ${(mx + r).toFixed(1)} ${ty.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      }
    }
  }
  // Case 2: Target is primarily to the West (Left)
  else if (dx <= -nodeWidth * 0.4) {
    sx = source.x;
    sy = source.y + nodeHeight / 2;
    tx = target.x + nodeWidth;
    ty = target.y + nodeHeight / 2;

    const mx = sx + (tx - sx) / 2;
    midX = mx;
    midY = (sy + ty) / 2;

    const deltaY = ty - sy;
    if (Math.abs(deltaY) < 6) {
      pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    } else {
      const r = Math.min(CORNER_RADIUS, Math.abs(deltaY) / 2, Math.abs(sx - tx) / 2);
      if (deltaY > 0) {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx + r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy + r).toFixed(1)} L ${mx.toFixed(1)} ${(ty - r).toFixed(1)} Q ${mx.toFixed(1)} ${ty.toFixed(1)}, ${(mx - r).toFixed(1)} ${ty.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      } else {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(mx + r).toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${(sy - r).toFixed(1)} L ${mx.toFixed(1)} ${(ty + r).toFixed(1)} Q ${mx.toFixed(1)} ${ty.toFixed(1)}, ${(mx - r).toFixed(1)} ${ty.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      }
    }
  }
  // Case 3: Target is primarily to the South (Below)
  else if (dy > 0) {
    sx = source.x + nodeWidth / 2;
    sy = source.y + nodeHeight;
    tx = target.x + nodeWidth / 2;
    ty = target.y;

    const my = sy + (ty - sy) / 2;
    midX = (sx + tx) / 2;
    midY = my;

    const deltaX = tx - sx;
    if (Math.abs(deltaX) < 6) {
      pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    } else {
      const r = Math.min(CORNER_RADIUS, Math.abs(deltaX) / 2, Math.abs(ty - sy) / 2);
      if (deltaX > 0) {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${sx.toFixed(1)} ${(my - r).toFixed(1)} Q ${sx.toFixed(1)} ${my.toFixed(1)}, ${(sx + r).toFixed(1)} ${my.toFixed(1)} L ${(tx - r).toFixed(1)} ${my.toFixed(1)} Q ${tx.toFixed(1)} ${my.toFixed(1)}, ${tx.toFixed(1)} ${(my + r).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      } else {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${sx.toFixed(1)} ${(my - r).toFixed(1)} Q ${sx.toFixed(1)} ${my.toFixed(1)}, ${(sx - r).toFixed(1)} ${my.toFixed(1)} L ${(tx + r).toFixed(1)} ${my.toFixed(1)} Q ${tx.toFixed(1)} ${my.toFixed(1)}, ${tx.toFixed(1)} ${(my + r).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      }
    }
  }
  // Case 4: Target is primarily to the North (Above)
  else {
    sx = source.x + nodeWidth / 2;
    sy = source.y;
    tx = target.x + nodeWidth / 2;
    ty = target.y + nodeHeight;

    const my = sy + (ty - sy) / 2;
    midX = (sx + tx) / 2;
    midY = my;

    const deltaX = tx - sx;
    if (Math.abs(deltaX) < 6) {
      pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    } else {
      const r = Math.min(CORNER_RADIUS, Math.abs(deltaX) / 2, Math.abs(sy - ty) / 2);
      if (deltaX > 0) {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${sx.toFixed(1)} ${(my + r).toFixed(1)} Q ${sx.toFixed(1)} ${my.toFixed(1)}, ${(sx + r).toFixed(1)} ${my.toFixed(1)} L ${(tx - r).toFixed(1)} ${my.toFixed(1)} Q ${tx.toFixed(1)} ${my.toFixed(1)}, ${tx.toFixed(1)} ${(my - r).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      } else {
        pathData = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${sx.toFixed(1)} ${(my + r).toFixed(1)} Q ${sx.toFixed(1)} ${my.toFixed(1)}, ${(sx - r).toFixed(1)} ${my.toFixed(1)} L ${(tx + r).toFixed(1)} ${my.toFixed(1)} Q ${tx.toFixed(1)} ${my.toFixed(1)}, ${tx.toFixed(1)} ${(my - r).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      }
    }
  }

  return {
    pathData,
    sourcePort: { x: sx, y: sy },
    targetPort: { x: tx, y: ty },
    midX: Number(midX.toFixed(1)),
    midY: Number(midY.toFixed(1)),
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
