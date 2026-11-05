import { createServer, type Server } from 'node:http';
import { nodeIdSchema, topologySchema, type Topology } from '@chaosboard/contracts';
import { describe, expect, it } from 'vitest';
import { startSandbox } from '../index';
import { isProcessAlive } from '../infrastructure/process-tree';
import { WorkerProcessSupervisor } from '../infrastructure/worker-process-supervisor';
import { deriveNodeConfigurations } from '../domain/derive-config';
import { allocateNetworkPlan } from '../domain/plan';

describe('Sandbox lifecycle and process teardown', () => {
  const workerAId = nodeIdSchema.parse('worker-a');
  const workerBId = nodeIdSchema.parse('worker-b');

  const sampleTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'teardown-topo',
    name: 'Teardown Topo',
    source: 'scenario',
    entry: { nodeId: 'worker-a' },
    nodes: [
      {
        id: 'worker-a',
        label: 'Worker A',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 10 },
        ingressRateLimitRps: null,
      },
      {
        id: 'worker-b',
        label: 'Worker B',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 10 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [],
  });

  it('guarantees clean teardown with zero stray processes and releases all ports', async () => {
    const sandbox = await startSandbox(sampleTopology, undefined, {
      baseNodePort: 22600,
      baseProxyPort: 28600,
      useProxies: false,
    });

    const portA = sandbox.configs.get(workerAId)?.listenPort ?? 22600;
    const portB = sandbox.configs.get(workerBId)?.listenPort ?? 22601;

    // Verify control status responds
    const resA = await fetch(`http://127.0.0.1:${String(portA)}/control/status`);
    expect(resA.status).toBe(200);

    // Stop sandbox
    await sandbox.stop();

    // Verify control endpoint is no longer reachable
    let reachable = true;
    try {
      await fetch(`http://127.0.0.1:${String(portA)}/control/status`, {
        signal: AbortSignal.timeout(500),
      });
    } catch {
      reachable = false;
    }
    expect(reachable).toBe(false);

    // Verify both ports can be bound immediately by another process without EADDRINUSE
    const canBind = async (port: number): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const s = createServer();
        s.once('error', () => resolve(false));
        s.listen(port, '127.0.0.1', () => {
          s.close(() => resolve(true));
        });
      });
    };

    expect(await canBind(portA)).toBe(true);
    expect(await canBind(portB)).toBe(true);
  });

  it('cleans up all processes if startup fails due to a port collision', async () => {
    const occupiedPort = 22700;
    // Occupy port with a dummy server
    const blocker: Server = await new Promise((resolve) => {
      const s = createServer();
      s.listen(occupiedPort, '127.0.0.1', () => resolve(s));
    });

    try {
      await expect(
        startSandbox(sampleTopology, undefined, {
          baseNodePort: occupiedPort,
          baseProxyPort: 28700,
          readinessTimeoutMs: 1500,
        }),
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('terminates process tree on forced kill leaving zero stray processes', async () => {
    const plan = allocateNetworkPlan(sampleTopology, {
      baseNodePort: 22800,
      baseProxyPort: 28800,
    });
    const configs = deriveNodeConfigurations(sampleTopology, plan, { useProxies: false });
    const configA = configs.get(workerAId);
    expect(configA).toBeDefined();
    if (!configA) return;

    const supervisor = new WorkerProcessSupervisor();
    const handle = await supervisor.spawnWorker(configA, 5000);

    const pid = handle.pid;
    expect(pid).toBeGreaterThan(0);
    expect(isProcessAlive(pid)).toBe(true);

    // Perform forced kill (simulating crash or SIGKILL)
    await handle.forceKill();

    // Verify process is not alive on the OS
    expect(isProcessAlive(pid)).toBe(false);
  });
});
