import { describe, expect, it } from 'vitest';
import { networkPlanSchema } from './network-plan';

describe('networkPlanSchema', () => {
  const validPlan = {
    schemaVersion: 1,
    topologyId: 'test-topology',
    nodes: [
      { nodeId: 'gateway', port: 20001 },
      { nodeId: 'auth', port: 20002 },
    ],
    edges: [{ edgeId: 'gateway-to-auth', proxyPort: 28001 }],
  };

  it('accepts a valid network plan', () => {
    const parsed = networkPlanSchema.parse(validPlan);
    expect(parsed.topologyId).toBe('test-topology');
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
  });

  it('rejects ports below 1024 or above 65535', () => {
    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        nodes: [{ nodeId: 'gateway', port: 80 }],
      }),
    ).toThrow();

    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        nodes: [{ nodeId: 'gateway', port: 70000 }],
      }),
    ).toThrow();

    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        edges: [{ edgeId: 'gateway-to-auth', proxyPort: 500 }],
      }),
    ).toThrow();
  });

  it('rejects unknown schema versions and extra keys (strict)', () => {
    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        schemaVersion: 2,
      }),
    ).toThrow();

    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        extraProperty: true,
      }),
    ).toThrow();
  });

  it('rejects invalid node and edge identifiers', () => {
    expect(() =>
      networkPlanSchema.parse({
        ...validPlan,
        nodes: [{ nodeId: 'INVALID_CAPS', port: 20001 }],
      }),
    ).toThrow();
  });
});
