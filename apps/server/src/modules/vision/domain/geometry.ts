import type { RedStrokePoint } from '@chaosboard/contracts';

export type Point = RedStrokePoint;
export type Segment = readonly [Point, Point];

/**
 * Cross product of vector (b - a) and (c - a) in 2D.
 * Positive if counter-clockwise, negative if clockwise, zero if collinear.
 */
function crossProduct(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Checks whether point c lies on segment ab (assuming collinearity). */
function isPointOnSegment(a: Point, b: Point, c: Point): boolean {
  return (
    c[0] >= Math.min(a[0], b[0]) - 1e-9 &&
    c[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    c[1] >= Math.min(a[1], b[1]) - 1e-9 &&
    c[1] <= Math.max(a[1], b[1]) + 1e-9
  );
}

/** Determines whether segment ab and segment cd intersect. */
export function doSegmentsIntersect(seg1: Segment, seg2: Segment): boolean {
  const [a, b] = seg1;
  const [c, d] = seg2;

  const cp1 = crossProduct(a, b, c);
  const cp2 = crossProduct(a, b, d);
  const cp3 = crossProduct(c, d, a);
  const cp4 = crossProduct(c, d, b);

  // General case: segments straddle each other
  if (
    ((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
    ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))
  ) {
    return true;
  }

  // Collinear or endpoint cases
  if (Math.abs(cp1) < 1e-9 && isPointOnSegment(a, b, c)) return true;
  if (Math.abs(cp2) < 1e-9 && isPointOnSegment(a, b, d)) return true;
  if (Math.abs(cp3) < 1e-9 && isPointOnSegment(c, d, a)) return true;
  if (Math.abs(cp4) < 1e-9 && isPointOnSegment(c, d, b)) return true;

  return false;
}

/** Finds exact intersection point between two segments, if they intersect cleanly. */
export function findSegmentIntersection(seg1: Segment, seg2: Segment): Point | null {
  if (!doSegmentsIntersect(seg1, seg2)) {
    return null;
  }

  const [p1, p2] = seg1;
  const [p3, p4] = seg2;

  const x1 = p1[0];
  const y1 = p1[1];
  const x2 = p2[0];
  const y2 = p2[1];
  const x3 = p3[0];
  const y3 = p3[1];
  const x4 = p4[0];
  const y4 = p4[1];

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) {
    // Segments are parallel or collinear; return midpoint of overlapping span
    return [
      Math.max(
        0,
        Math.min(
          1,
          (Math.max(Math.min(x1, x2), Math.min(x3, x4)) +
            Math.min(Math.max(x1, x2), Math.max(x3, x4))) /
            2,
        ),
      ),
      Math.max(
        0,
        Math.min(
          1,
          (Math.max(Math.min(y1, y2), Math.min(y3, y4)) +
            Math.min(Math.max(y1, y2), Math.max(y3, y4))) /
            2,
        ),
      ),
    ];
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const ix = x1 + t * (x2 - x1);
  const iy = y1 + t * (y2 - y1);

  return [
    Math.max(0, Math.min(1, Math.round(ix * 1000) / 1000)),
    Math.max(0, Math.min(1, Math.round(iy * 1000) / 1000)),
  ];
}

/** Finds all intersection points between two polylines. */
export function findPolylineIntersections(
  polylineA: readonly Point[],
  polylineB: readonly Point[],
): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < polylineA.length - 1; i++) {
    const a1 = polylineA[i];
    const a2 = polylineA[i + 1];
    if (!a1 || !a2) continue;
    const segA: Segment = [a1, a2];

    for (let j = 0; j < polylineB.length - 1; j++) {
      const b1 = polylineB[j];
      const b2 = polylineB[j + 1];
      if (!b1 || !b2) continue;
      const segB: Segment = [b1, b2];

      const pt = findSegmentIntersection(segA, segB);
      if (pt !== null) {
        // Deduplicate close points
        const alreadyFound = intersections.some(
          (existing) =>
            Math.abs(existing[0] - pt[0]) < 0.01 && Math.abs(existing[1] - pt[1]) < 0.01,
        );
        if (!alreadyFound) {
          intersections.push(pt);
        }
      }
    }
  }

  return intersections;
}

/** Perpendicular distance from point p to line segment ab. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) {
    return Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  return Math.abs(crossProduct(a, b, p)) / Math.sqrt(lengthSq);
}

/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
 */
export function simplifyPolyline(points: readonly Point[], tolerance = 0.02): Point[] {
  if (points.length <= 2) {
    return [...points];
  }

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) {
    return [];
  }

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    if (!pt) continue;
    const dist = perpendicularDistance(pt, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolyline(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}
