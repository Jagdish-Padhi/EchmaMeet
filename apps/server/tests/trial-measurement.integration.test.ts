import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import {
  allocateNetworkPlan,
  startSandbox,
  startLoadgen,
  type SandboxHandle,
  type LoadgenHandle,
} from '../src/modules/sandbox';
import { createChaosService, type ChaosService } from '../src/modules/chaos';
import { createMeasurementService } from '../src/modules/measurement';
import {
  edgeIdSchema,
  faultIdSchema,
  nodeIdSchema,
  topologySchema,
  type Fault,
  type LoadgenConfig,
  type Topology,
  type TrialResult,
} from '@chaosboard/contracts';

const retryStormJson: unknown = JSON.parse(
  readFileSync(
    new URL('../src/modules/topology/tests/fixtures/scenarios/retry-storm.json', import.meta.url),
    'utf8',
  ),
);

describe('Trial measurement and fault injection integration', () => {
  let sandbox: SandboxHandle | null = null;
  let loadgen: LoadgenHandle | null = null;
  let chaos: ChaosService | null = null;

  afterEach(async () => {
    if (loadgen && loadgen.isRunning()) {
      await loadgen.forceKill();
      loadgen = null;
    }
    if (chaos) {
      await chaos.teardown().catch(() => undefined);
      chaos = null;
    }
    if (sandbox) {
      await sandbox.stop().catch(() => undefined);
      sandbox = null;
    }
  });

  it('measures repeatable latency degradation under Toxiproxy latency toxic across 3-node topology', async () => {
    const topology: Topology = topologySchema.parse({
      schemaVersion: 1,
      id: 'three-node-latency-topo',
      name: 'Three Node Latency Topo',
      source: 'scenario',
      entry: { nodeId: 'entry' },
      nodes: [
        {
          id: 'entry',
          label: 'Entry Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 50 },
          ingressRateLimitRps: null,
        },
        {
          id: 'mid',
          label: 'Middle Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 50 },
          ingressRateLimitRps: null,
        },
        {
          id: 'sink',
          label: 'Sink Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 50 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'entry-to-mid',
          source: 'entry',
          target: 'mid',
          mode: 'sync_call',
          policy: {
            timeoutMs: 2000,
            retry: {
              maxAttempts: 1,
              backoffBaseMs: 0,
              backoffMultiplier: 1,
              maxBackoffMs: 0,
              jitter: 'none',
            },
            breaker: {
              enabled: false,
              failureThresholdPct: 50,
              windowRequests: 10,
              cooldownMs: 2000,
              halfOpenProbes: 2,
            },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 10 },
          },
        },
        {
          id: 'mid-to-sink',
          source: 'mid',
          target: 'sink',
          mode: 'sync_call',
          policy: {
            timeoutMs: 2000,
            retry: {
              maxAttempts: 1,
              backoffBaseMs: 0,
              backoffMultiplier: 1,
              maxBackoffMs: 0,
              jitter: 'none',
            },
            breaker: {
              enabled: false,
              failureThresholdPct: 50,
              windowRequests: 10,
              cooldownMs: 2000,
              halfOpenProbes: 2,
            },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 10 },
          },
        },
      ],
    });

    const plan = allocateNetworkPlan(topology, {
      baseNodePort: 23200,
      baseProxyPort: 28010,
    });

    // Configure Toxiproxy proxies
    chaos = createChaosService('http://127.0.0.1:8474', {
      upstreamHost: 'host.docker.internal',
    });

    const edgeTargets = new Map<string, number>();
    for (const edge of topology.edges) {
      const targetNodeAlloc = plan.nodes.find((n) => n.nodeId === edge.target);
      if (targetNodeAlloc) {
        edgeTargets.set(edge.id, targetNodeAlloc.port);
      }
    }

    await chaos.createProxiesForPlan(plan, edgeTargets);

    // Start worker processes with proxy routing
    sandbox = await startSandbox(topology, plan, {
      useProxies: true,
    });

    const entryNodeId = nodeIdSchema.parse('entry');
    const midToSinkEdgeId = edgeIdSchema.parse('mid-to-sink');
    const entryConfig = sandbox.configs.get(entryNodeId);
    expect(entryConfig).toBeDefined();
    if (!entryConfig) return;

    const targetUrl = `http://${entryConfig.listenHost}:${String(entryConfig.listenPort)}/request`;
    const measurement = createMeasurementService();

    // 1. Baseline trial (no fault)
    const baselineStartCounters = await sandbox.readCounters();
    const baselineLoadConfig: LoadgenConfig = {
      targetUrl,
      arrivalProcess: 'constant',
      arrivalRateRps: 10,
      warmupDurationMs: 400,
      measurementDurationMs: 1000,
      cooldownDurationMs: 100,
      clientTimeoutMs: 1000,
      seed: 101,
      requestIdPrefix: 'base',
      method: 'POST',
    };

    loadgen = await startLoadgen(baselineLoadConfig);
    const baselineLoadResult = await loadgen.waitForCompletion();
    const baselineEndCounters = await sandbox.readCounters();
    const baselineSeries = await sandbox.readSeries();
    const baselineDelays = await sandbox.readDelays();

    const baselineTrial = measurement.buildTrialResult({
      trialIndex: 0,
      seed: 101,
      records: baselineLoadResult.records,
      startCounters: baselineStartCounters,
      endCounters: baselineEndCounters,
      workerSeries: baselineSeries,
      workerEventLoopDelays: baselineDelays,
      nodeMaxWorkers: new Map([
        ['entry', 10],
        ['mid', 10],
        ['sink', 10],
      ]),
      edgeIds: ['entry-to-mid', 'mid-to-sink'],
      loadgenSummary: baselineLoadResult.summary,
    });

    expect(baselineTrial.validity).toEqual({ valid: true, reason: null });
    expect(baselineTrial.metrics.completionRate).toBe(1.0);
    expect(baselineTrial.metrics.p99LatencyMs).toBeLessThan(350);

    // 2. Faulted trial (200ms latency on mid-to-sink)
    const latencyFault: Fault = {
      id: faultIdSchema.parse('fault-latency'),
      edgeId: midToSinkEdgeId,
      type: 'latency',
      latencyMs: 200,
      jitterMs: 0,
      toxicity: 1.0,
      direction: 'downstream',
      startOffsetMs: 0,
    };

    await chaos.applyFault(latencyFault);

    const faultedStartCounters = await sandbox.readCounters();
    const faultedLoadConfig: LoadgenConfig = {
      ...baselineLoadConfig,
      seed: 102,
      requestIdPrefix: 'fault',
    };

    loadgen = await startLoadgen(faultedLoadConfig);
    const faultedLoadResult = await loadgen.waitForCompletion();
    const faultedEndCounters = await sandbox.readCounters();
    const faultedSeries = await sandbox.readSeries();
    const faultedDelays = await sandbox.readDelays();

    const faultedTrial = measurement.buildTrialResult({
      trialIndex: 1,
      seed: 102,
      records: faultedLoadResult.records,
      startCounters: faultedStartCounters,
      endCounters: faultedEndCounters,
      workerSeries: faultedSeries,
      workerEventLoopDelays: faultedDelays,
      nodeMaxWorkers: new Map([
        ['entry', 10],
        ['mid', 10],
        ['sink', 10],
      ]),
      edgeIds: ['entry-to-mid', 'mid-to-sink'],
      loadgenSummary: faultedLoadResult.summary,
    });

    expect(faultedTrial.validity.valid).toBe(true);
    expect(faultedTrial.metrics.completionRate).toBe(1.0);
    // Latency increased significantly due to 200ms injected delay
    expect(faultedTrial.metrics.p99LatencyMs).toBeGreaterThanOrEqual(210);
    const faultedP99 = faultedTrial.metrics.p99LatencyMs;
    const baselineP99 = baselineTrial.metrics.p99LatencyMs;
    expect(faultedP99).toBeDefined();
    expect(baselineP99).toBeDefined();
    if (faultedP99 !== null && baselineP99 !== null) {
      expect(faultedP99).toBeGreaterThan(baselineP99 + 50);
    }

    // 3. Remove toxic and verify recovery
    await chaos.clearFault(latencyFault);

    const restoredStartCounters = await sandbox.readCounters();
    const restoredLoadConfig: LoadgenConfig = {
      ...baselineLoadConfig,
      seed: 103,
      requestIdPrefix: 'restored',
    };

    loadgen = await startLoadgen(restoredLoadConfig);
    const restoredLoadResult = await loadgen.waitForCompletion();
    const restoredEndCounters = await sandbox.readCounters();
    const restoredSeries = await sandbox.readSeries();
    const restoredDelays = await sandbox.readDelays();

    const restoredTrial = measurement.buildTrialResult({
      trialIndex: 2,
      seed: 103,
      records: restoredLoadResult.records,
      startCounters: restoredStartCounters,
      endCounters: restoredEndCounters,
      workerSeries: restoredSeries,
      workerEventLoopDelays: restoredDelays,
      nodeMaxWorkers: new Map([
        ['entry', 10],
        ['mid', 10],
        ['sink', 10],
      ]),
      edgeIds: ['entry-to-mid', 'mid-to-sink'],
      loadgenSummary: restoredLoadResult.summary,
    });

    expect(restoredTrial.validity.valid).toBe(true);
    expect(restoredTrial.metrics.p99LatencyMs).toBeLessThan(350);
  });

  it('demonstrates Scenario 1 retry storm with measurable degradation relative to baseline', async () => {
    const topology: Topology = topologySchema.parse(retryStormJson);
    const plan = allocateNetworkPlan(topology, {
      baseNodePort: 23300,
      baseProxyPort: 28020,
    });

    chaos = createChaosService('http://127.0.0.1:8474', {
      upstreamHost: 'host.docker.internal',
    });

    const edgeTargets = new Map<string, number>();
    for (const edge of topology.edges) {
      const targetNodeAlloc = plan.nodes.find((n) => n.nodeId === edge.target);
      if (targetNodeAlloc) {
        edgeTargets.set(edge.id, targetNodeAlloc.port);
      }
    }

    await chaos.createProxiesForPlan(plan, edgeTargets);

    sandbox = await startSandbox(topology, plan, {
      useProxies: true,
    });

    const gatewayNodeId = nodeIdSchema.parse('gateway');
    const edgeCheckoutToInventory = edgeIdSchema.parse('checkout-to-inventory');

    const gatewayConfig = sandbox.configs.get(gatewayNodeId);
    expect(gatewayConfig).toBeDefined();
    if (!gatewayConfig) return;

    const targetUrl = `http://${gatewayConfig.listenHost}:${String(gatewayConfig.listenPort)}/request`;
    const measurement = createMeasurementService();

    const maxWorkers = new Map([
      ['gateway', 50],
      ['checkout', 30],
      ['inventory', 20],
    ]);
    const edgeIds = ['gateway-to-checkout', 'checkout-to-inventory'];

    // Run 2 baseline trials
    const baselineTrials: TrialResult[] = [];
    for (let i = 0; i < 2; i += 1) {
      const startCounters = await sandbox.readCounters();
      const loadConfig: LoadgenConfig = {
        targetUrl,
        arrivalProcess: 'constant',
        arrivalRateRps: 10,
        warmupDurationMs: 400,
        measurementDurationMs: 1000,
        cooldownDurationMs: 100,
        clientTimeoutMs: 2000,
        seed: 200 + i,
        requestIdPrefix: `s1-base-${String(i)}`,
        method: 'POST',
      };

      loadgen = await startLoadgen(loadConfig);
      const loadResult = await loadgen.waitForCompletion();
      const endCounters = await sandbox.readCounters();
      const series = await sandbox.readSeries();
      const delays = await sandbox.readDelays();

      const trial = measurement.buildTrialResult({
        trialIndex: i,
        seed: 200 + i,
        records: loadResult.records,
        startCounters,
        endCounters,
        workerSeries: series,
        workerEventLoopDelays: delays,
        nodeMaxWorkers: maxWorkers,
        edgeIds,
        loadgenSummary: loadResult.summary,
      });

      expect(trial.validity).toEqual({ valid: true, reason: null });
      baselineTrials.push(trial);
    }

    const baselineAggregate = measurement.aggregateTrials(baselineTrials);
    expect(baselineAggregate.validTrialsCount).toBe(2);
    expect(baselineAggregate.metrics.completionRate.median).toBe(1.0);
    expect(baselineAggregate.metrics.retryAmplification[edgeCheckoutToInventory]?.median).toBe(1.0);
    expect(baselineAggregate.metrics.p99LatencyMs.median).toBeLessThan(350);

    // Apply downstream latency toxic that triggers retries on checkout-to-inventory:
    // Checkout timeout is 3000ms. If we inject latency with reset or 1500ms latency,
    // let's inject connection_reset with 20ms delay on checkout-to-inventory with toxicity 1.0!
    // This causes checkout to immediately fail, and with maxAttempts: 3, it sends 3 attempts per call!
    const retryFault: Fault = {
      id: faultIdSchema.parse('fault-retry-storm'),
      edgeId: edgeCheckoutToInventory,
      type: 'connection_reset',
      afterMs: 10,
      toxicity: 1.0,
      direction: 'downstream',
      startOffsetMs: 0,
    };

    await chaos.applyFault(retryFault);

    // Run 2 faulted trials
    const faultedTrials: TrialResult[] = [];
    for (let i = 0; i < 2; i += 1) {
      const startCounters = await sandbox.readCounters();
      const loadConfig: LoadgenConfig = {
        targetUrl,
        arrivalProcess: 'constant',
        arrivalRateRps: 10,
        warmupDurationMs: 100,
        measurementDurationMs: 1000,
        cooldownDurationMs: 100,
        clientTimeoutMs: 2000,
        seed: 300 + i,
        requestIdPrefix: `s1-fault-${String(i)}`,
        method: 'POST',
      };

      loadgen = await startLoadgen(loadConfig);
      const loadResult = await loadgen.waitForCompletion();
      const endCounters = await sandbox.readCounters();
      const series = await sandbox.readSeries();
      const faultedDelays = await sandbox.readDelays();

      const trial = measurement.buildTrialResult({
        trialIndex: i,
        seed: 300 + i,
        records: loadResult.records,
        startCounters,
        endCounters,
        workerSeries: series,
        workerEventLoopDelays: faultedDelays,
        nodeMaxWorkers: maxWorkers,
        edgeIds,
        loadgenSummary: loadResult.summary,
      });

      expect(trial.validity).toEqual({ valid: true, reason: null });
      faultedTrials.push(trial);
    }

    const faultedAggregate = measurement.aggregateTrials(faultedTrials);
    expect(faultedAggregate.validTrialsCount).toBe(2);

    // Retry storm demonstration:
    // Retries were triggered on checkout-to-inventory (maxAttempts 3):
    const retryAmp =
      faultedAggregate.metrics.retryAmplification[edgeCheckoutToInventory]?.median ?? 0;
    expect(retryAmp).toBeGreaterThanOrEqual(2.0);

    // Error rate increases / completion rate drops to 0 (all 503 fail fast):
    expect(faultedAggregate.metrics.completionRate.median).toBe(0);
  });
});
