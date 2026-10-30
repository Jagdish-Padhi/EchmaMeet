import { describe, expect, it } from 'vitest';
import { computeEdgeRoute, computeRubberbandRoute } from '../utils/edge-router';

describe('edge-router', () => {
  it('connects horizontally from East to West when target is to the right', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 400, y: 100 };

    const route = computeEdgeRoute(source, target);

    // Source East port is (100 + 184, 100 + 38) = (284, 138)
    expect(route.sourcePort.x).toBe(284);
    expect(route.sourcePort.y).toBe(138);

    // Target West port is (400, 100 + 38) = (400, 138)
    expect(route.targetPort.x).toBe(400);
    expect(route.targetPort.y).toBe(138);

    expect(route.pathData).toContain('M 284.0 138.0 C');
    expect(route.midX).toBeGreaterThan(284);
    expect(route.midX).toBeLessThan(400);
  });

  it('connects vertically from South to North when target is below', () => {
    const source = { x: 100, y: 100 };
    const target = { x: 100, y: 350 };

    const route = computeEdgeRoute(source, target);

    // Source South port is (100 + 92, 100 + 76) = (192, 176)
    expect(route.sourcePort.x).toBe(192);
    expect(route.sourcePort.y).toBe(176);

    // Target North port is (100 + 92, 350) = (192, 350)
    expect(route.targetPort.x).toBe(192);
    expect(route.targetPort.y).toBe(350);

    expect(route.pathData).toContain('M 192.0 176.0 C');
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

  it('generates smooth rubberband path to cursor', () => {
    const source = { x: 100, y: 100 };
    const cursor = { x: 300, y: 200 };

    const path = computeRubberbandRoute(source, cursor);
    expect(path).toContain('M 284.0 138.0 C');
    expect(path).toContain('300.0 200.0');
  });
});
