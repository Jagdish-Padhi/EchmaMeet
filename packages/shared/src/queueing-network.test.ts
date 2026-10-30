import { describe, expect, it } from 'vitest';
import {
  calculateBlastRadius,
  solveJacksonNetwork,
  type QueueEdgeInput,
  type QueueNodeInput,
} from './queueing-network';

describe('queueing-network', () => {
  it('solves simple linear pipeline M/M/c queueing theory metrics', () => {
    const nodes: QueueNodeInput[] = [
      { id: 'gateway', serviceTimeMs: 10, maxWorkers: 10, externalArrivalRps: 50 },
      { id: 'service-a', serviceTimeMs: 15, maxWorkers: 10 },
      { id: 'database', serviceTimeMs: 25, maxWorkers: 5 },
    ];

    const edges: QueueEdgeInput[] = [
      { source: 'gateway', target: 'service-a' },
      { source: 'service-a', target: 'database' },
    ];

    const result = solveJacksonNetwork(nodes, edges);

    expect(result.nodes.length).toBe(3);
    const gw = result.nodes.find((n) => n.id === 'gateway');
    const svc = result.nodes.find((n) => n.id === 'service-a');
    const db = result.nodes.find((n) => n.id === 'database');

    expect(gw).toBeDefined();
    expect(svc).toBeDefined();
    expect(db).toBeDefined();
    if (!gw || !svc || !db) return;

    // Gateway arrival rate is 50 rps
    expect(gw.arrivalRateRps).toBe(50);
    // Flows through to service-a and database
    expect(svc.arrivalRateRps).toBe(50);
    expect(db.arrivalRateRps).toBe(50);

    // Latencies are strictly positive and greater than pure service time
    expect(gw.residenceTimeMs).toBeGreaterThanOrEqual(10);
    expect(svc.residenceTimeMs).toBeGreaterThanOrEqual(15);
    expect(db.residenceTimeMs).toBeGreaterThanOrEqual(25);

    // Critical path includes all 3 in sequence
    expect(result.criticalPath).toEqual(['gateway', 'service-a', 'database']);
    expect(result.endToEndP99Ms).toBeGreaterThan(50);
  });

  it('detects bottleneck saturation when arrival rate exceeds capacity', () => {
    const nodes: QueueNodeInput[] = [
      { id: 'gateway', serviceTimeMs: 5, maxWorkers: 20, externalArrivalRps: 100 },
      // Weak bottleneck: 1 worker with 20ms service time -> capacity is 50 rps, but gets 100 rps
      { id: 'bottleneck', serviceTimeMs: 20, maxWorkers: 1, maxQueueDepth: 100 },
    ];

    const edges: QueueEdgeInput[] = [{ source: 'gateway', target: 'bottleneck' }];

    const result = solveJacksonNetwork(nodes, edges);
    const bNode = result.nodes.find((n) => n.id === 'bottleneck');
    expect(bNode).toBeDefined();
    if (!bNode) return;

    expect(bNode.isSaturated).toBe(true);
    expect(bNode.utilization).toBeGreaterThanOrEqual(1.0);
    expect(bNode.dropRateRps).toBeGreaterThan(0);
    expect(result.bottleneckNodeId).toBe('bottleneck');
  });

  it('calculates blast radius across direct and transitive dependencies', () => {
    const nodes = [
      { id: 'gateway' },
      { id: 'auth' },
      { id: 'orders' },
      { id: 'inventory' },
      { id: 'payments' },
    ];
    const edges = [
      { source: 'gateway', target: 'auth' },
      { source: 'gateway', target: 'orders' },
      { source: 'orders', target: 'inventory' },
      { source: 'orders', target: 'payments' },
    ];

    // Blast radius of 'orders'
    const blast = calculateBlastRadius('orders', nodes, edges);

    expect(blast.targetId).toBe('orders');
    expect(blast.directDownstream).toEqual(['inventory', 'payments']);
    // Upstream includes gateway
    expect(blast.impactedNodes).toContain('gateway');
    expect(blast.impactedNodes).toContain('inventory');
    expect(blast.impactedNodes).toContain('payments');
    expect(blast.impactedCount).toBe(4); // gateway, orders, inventory, payments
    expect(blast.blastRadiusPct).toBe(80);
    expect(blast.severity).toBe('critical');
  });
});
