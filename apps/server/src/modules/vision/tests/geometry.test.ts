import { describe, expect, it } from 'vitest';
import {
  doSegmentsIntersect,
  findPolylineIntersections,
  findSegmentIntersection,
  simplifyPolyline,
  type Point,
  type Segment,
} from '../domain/geometry';

describe('vision geometry domain', () => {
  it('correctly detects intersecting segments', () => {
    const s1: Segment = [
      [0.2, 0.2],
      [0.8, 0.8],
    ];
    const s2: Segment = [
      [0.2, 0.8],
      [0.8, 0.2],
    ];
    expect(doSegmentsIntersect(s1, s2)).toBe(true);
    const pt = findSegmentIntersection(s1, s2);
    expect(pt).toEqual([0.5, 0.5]);
  });

  it('correctly detects non-intersecting parallel segments', () => {
    const s1: Segment = [
      [0.1, 0.2],
      [0.9, 0.2],
    ];
    const s2: Segment = [
      [0.1, 0.4],
      [0.9, 0.4],
    ];
    expect(doSegmentsIntersect(s1, s2)).toBe(false);
    expect(findSegmentIntersection(s1, s2)).toBeNull();
  });

  it('finds polyline intersections across multi-point segments', () => {
    const polyA: Point[] = [
      [0.1, 0.5],
      [0.5, 0.5],
      [0.9, 0.5],
    ];
    const polyB: Point[] = [
      [0.5, 0.1],
      [0.5, 0.9],
    ];
    const intersections = findPolylineIntersections(polyA, polyB);
    expect(intersections).toHaveLength(1);
    expect(intersections[0]).toEqual([0.5, 0.5]);
  });

  it('simplifies collinear or nearly collinear points', () => {
    const points: Point[] = [
      [0.0, 0.0],
      [0.2, 0.001],
      [0.5, 0.0],
      [0.8, -0.001],
      [1.0, 0.0],
    ];
    const simplified = simplifyPolyline(points, 0.02);
    expect(simplified).toEqual([
      [0.0, 0.0],
      [1.0, 0.0],
    ]);
  });
});
