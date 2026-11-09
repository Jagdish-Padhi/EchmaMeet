import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EdgeId, Fault, NodeId, Topology } from '@chaosboard/contracts';
import { RepairControls } from '../components/RepairControls';

describe('RepairControls component', () => {
  const dummyTopology: Topology = {
    schemaVersion: 1,
    id: 'topo-test' as any,
    name: 'Test Topology',
    source: 'canvas',
    entry: { nodeId: 'gateway' as NodeId },
    nodes: [
      {
        id: 'gateway' as NodeId,
        label: 'Gateway',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
      {
        id: 'inventory' as NodeId,
        label: 'Inventory',
        kind: 'service',
        processing: { distribution: 'constant', ms: 20 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [
      {
        id: 'edge-gw-inv' as EdgeId,
        source: 'gateway' as NodeId,
        target: 'inventory' as NodeId,
        mode: 'sync_call',
        policy: {
          timeoutMs: 500,
          retry: {
            maxAttempts: 2,
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 200,
            jitter: 'full',
          },
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 5000,
            halfOpenProbes: 1,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 50 },
        },
      },
    ],
  };

  const dummyFault: Fault = {
    id: 'fault-1' as any,
    edgeId: 'edge-gw-inv' as EdgeId,
    type: 'latency',
    latencyMs: 800,
    jitterMs: 100,
    toxicity: 1,
    direction: 'downstream',
    startOffsetMs: 0,
  };

  it('renders idle state with target connection and failure profile selection', () => {
    const html = renderToStaticMarkup(
      <RepairControls
        status="idle"
        proposerKind="model"
        maxIterations={5}
        currentTopology={dummyTopology}
        activeFault={dummyFault}
        onFaultChange={() => {}}
        onProposerChange={() => {}}
        onMaxIterationsChange={() => {}}
        onStart={() => {}}
        onCancel={() => {}}
        canStart={true}
      />,
    );

    expect(html).toContain('Autonomous Resilience Optimizer');
    expect(html).toContain('Target Connection');
    expect(html).toContain('gateway → inventory');
    expect(html).toContain('Stress Failure Profile');
    expect(html).toContain('Run Autonomous Optimizer');
  });

  it('renders failure banner with error message and reset button when status is failed', () => {
    const html = renderToStaticMarkup(
      <RepairControls
        status="failed"
        errorMessage="Baseline experiment failed: edge not found"
        proposerKind="model"
        maxIterations={5}
        currentTopology={dummyTopology}
        activeFault={dummyFault}
        onFaultChange={() => {}}
        onProposerChange={() => {}}
        onMaxIterationsChange={() => {}}
        onStart={() => {}}
        onCancel={() => {}}
        onReset={() => {}}
        canStart={true}
      />,
    );

    expect(html).toContain('Resilience Optimization Blocked');
    expect(html).toContain('Baseline experiment failed: edge not found');
    expect(html).toContain('Reset Optimizer');
    expect(html).toContain('Retry Optimization');
  });

  it('renders success banner with Apply to Whiteboard button when status is repaired', () => {
    const html = renderToStaticMarkup(
      <RepairControls
        status="repaired"
        proposerKind="model"
        maxIterations={5}
        currentTopology={dummyTopology}
        activeFault={dummyFault}
        hasBestTopology={true}
        onFaultChange={() => {}}
        onProposerChange={() => {}}
        onMaxIterationsChange={() => {}}
        onStart={() => {}}
        onCancel={() => {}}
        onApplyPatches={() => {}}
        onExportIaC={() => {}}
        canStart={true}
      />,
    );

    expect(html).toContain('Optimal Resilience Configuration Discovered');
    expect(html).toContain('Apply to Whiteboard');
    expect(html).toContain('Export IaC Manifests');
  });

  it('renders running progress state when status is running', () => {
    const html = renderToStaticMarkup(
      <RepairControls
        status="running"
        proposerKind="model"
        maxIterations={5}
        currentTopology={dummyTopology}
        activeFault={dummyFault}
        onFaultChange={() => {}}
        onProposerChange={() => {}}
        onMaxIterationsChange={() => {}}
        onStart={() => {}}
        onCancel={() => {}}
        canStart={true}
      />,
    );

    expect(html).toContain('Evaluating architecture resilience');
    expect(html).toContain('Cancel Optimization');
  });
});
