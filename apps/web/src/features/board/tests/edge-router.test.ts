import { describe, expect, it } from 'vitest';
import { computeEdgeRoute, computeRubberbandRoute } from '../utils/edge-router';

describe('edge-router', () => {
  it('connects horizontally from East to West when target is directly to the right', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 400, y: 100 };

    const route = computeEdgeRoute(source, target);

    // Source East port is (100 + 184, 100 + 38) = (284, 138)
    expect(route.sourcePort.x).toBe(284);
    expect(route.sourcePort.y).toBe(138);

    // Target West port is (400, 100 + 38) = (400, 138)
    expect(route.targetPort.x).toBe(400);
    expect(route.targetPort.y).toBe(138);

    expect(route.pathData).toBe('M 284.0 138.0 L 400.0 138.0');
    expect(route.midX).toBe(342);
    expect(route.midY).toBe(138);
  });

  it('connects with rounded orthogonal bend when target is down and to the right', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 400, y: 300 };

    const route = computeEdgeRoute(source, target);

    expect(route.sourcePort.x).toBe(284);
    expect(route.targetPort.x).toBe(400);
    expect(route.pathData).toContain('Q');
    expect(route.midX).toBe(342);
  });

  it('connects vertically from South to North when target is directly below', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 100, y: 350 };

    const route = computeEdgeRoute(source, target);

    // Source South port is (100 + 92, 100 + 76) = (192, 176)
    expect(route.sourcePort.x).toBe(192);
    expect(route.sourcePort.y).toBe(176);

    // Target North port is (100 + 92, 350) = (192, 350)
    expect(route.targetPort.x).toBe(192);
    expect(route.targetPort.y).toBe(350);

    expect(route.pathData).toBe('M 192.0 176.0 L 192.0 350.0');
  });

  it('connects from West to East when target is to the left', () => {
    const source = { x: 500, y: 100 };
    const target = { x: 100, y: 100 };

    const route = computeEdgeRoute(source, target);

    // Source West port: (500, 138)
    expect(route.sourcePort.x).toBe(500);
    // Target East port: (100 + 184, 138) = (284, 138)
    expect(route.targetPort.x).toBe(284);
  });

  it('generates stepped rubberband path to cursor', () => {
    const source = { x: 100, y: 100 };
    const cursor = { x: 400, y: 250 };

    const path = computeRubberbandRoute(source, cursor);
    expect(path).toContain('M 284.0 138.0');
    expect(path).toContain('400.0 250.0');
  });

  it('computes smooth orthogonal path with custom control point and segments', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 500, y: 300 };
    const controlPoint = { x: 350, y: 220 };

    const route = computeEdgeRoute(source, target, 184, 76, controlPoint);

    expect(route.controlPoint).toEqual(controlPoint);
    expect(route.segments.length).toBeGreaterThanOrEqual(1);
    expect(route.pathData).toContain('Q');
    expect(typeof route.midX).toBe('number');
    expect(typeof route.midY).toBe('number');
  });

  it('separates bidirectional edges with non-overlapping corridors', () => {
    const nodeA = { x: 100, y: 100 };
    const nodeB = { x: 500, y: 100 };

    const forwardRoute = computeEdgeRoute(nodeA, nodeB, 184, 76, null, -24);
    const reverseRoute = computeEdgeRoute(nodeB, nodeA, 184, 76, null, 24);

    // Forward and reverse edges must have distinct non-colliding port coordinates
    expect(forwardRoute.sourcePort.y).not.toBe(reverseRoute.targetPort.y);
    expect(forwardRoute.pathData).not.toBe(reverseRoute.pathData);
  });

  it('reliably connects from left source port to bottom target port without defaulting to top', () => {
    // User scenario: Kafka Stream at (700, 600) drawn from left side to API Gateway at (100, 200) bottom side
    const source = { x: 700, y: 600 };
    const target = { x: 100, y: 200 };

    const route = computeEdgeRoute(source, target, 184, 76, null, 0, 'left', 'bottom');

    // Source port must strictly start on the left side of Kafka (700, 600 + 38 = 638)
    expect(route.sourcePort.x).toBe(700);
    expect(route.sourcePort.y).toBe(638);

    // Target port must strictly enter bottom of Gateway (100 + 92 = 192, 200 + 76 = 276)
    expect(route.targetPort.x).toBe(192);
    expect(route.targetPort.y).toBe(276);

    // Every segment must be provided with slide handles for complete user freedom
    expect(route.segments.length).toBeGreaterThanOrEqual(1);
    expect(route.pathData).toContain('M 700.0 638.0');
    expect(route.pathData).toContain('192.0 276.0');
  });

  it('reliably attaches to precision target sides (top, bottom, left, right) without detaching source port', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 500, y: 300 };

    // When attached to top port of target
    const topRoute = computeEdgeRoute(source, target, 184, 76, null, 0, undefined, 'top');
    expect(topRoute.targetPort.x).toBe(500 + 92);
    expect(topRoute.targetPort.y).toBe(300);
    // Source port remains anchored on source boundary
    expect(topRoute.sourcePort.x).toBe(100 + 92);
    expect(topRoute.sourcePort.y).toBe(100 + 76);

    // When attached to bottom port of target
    const bottomRoute = computeEdgeRoute(source, target, 184, 76, null, 0, undefined, 'bottom');
    expect(bottomRoute.targetPort.x).toBe(500 + 92);
    expect(bottomRoute.targetPort.y).toBe(300 + 76);
    expect(bottomRoute.sourcePort.x).toBe(100 + 184);

    // When custom control point is provided, sourcePort position must NOT be corrupted into empty space
    const customControl = { x: 380, y: 220 };
    const controlRoute = computeEdgeRoute(source, target, 184, 76, customControl);
    expect(controlRoute.sourcePort.x).toBe(100 + 184);
    expect(controlRoute.sourcePort.y).toBe(100 + 38);
    expect(controlRoute.targetPort.x).toBe(500);
    expect(controlRoute.targetPort.y).toBe(300 + 38);
  });
});
