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
});
