import { describe, it, expect } from 'vitest';
import { evaluateTrialValidity } from '../validity';

describe('evaluateTrialValidity', () => {
  const normalLag = { minMs: 0.1, maxMs: 15, meanMs: 1.2, p50Ms: 0.8, p90Ms: 2.5, p99Ms: 8.5 };
  const normalDelay = { minMs: 0.1, maxMs: 10, meanMs: 0.5, p50Ms: 0.3, p90Ms: 1.2, p99Ms: 4.5 };

  it('marks trial valid when diagnostics are within limits and no crash', () => {
    const validity = evaluateTrialValidity({
      generatorLag: normalLag,
      generatorEventLoopDelay: normalDelay,
      workerEventLoopDelays: { 'node-1': normalDelay },
    });
    expect(validity.valid).toBe(true);
    expect(validity.reason).toBeNull();
  });

  it('marks trial invalid if a process crashed', () => {
    const validity = evaluateTrialValidity({
      generatorLag: normalLag,
      generatorEventLoopDelay: normalDelay,
      workerEventLoopDelays: {},
      processCrash: 'Worker backend exited with code 1',
    });
    expect(validity.valid).toBe(false);
    expect(validity.reason).toContain('Process crashed unexpectedly');
  });

  it('marks trial invalid if generator p99 lag exceeds limit', () => {
    const badLag = { ...normalLag, p99Ms: 35.0 };
    const validity = evaluateTrialValidity({
      generatorLag: badLag,
      generatorEventLoopDelay: normalDelay,
      workerEventLoopDelays: {},
      limits: { maxP99GeneratorLagMs: 25 },
    });
    expect(validity.valid).toBe(false);
    expect(validity.reason).toContain('Generator p99 lag');
  });

  it('marks trial invalid if worker event loop delay exceeds limit', () => {
    const badDelay = { ...normalDelay, p99Ms: 120.0 };
    const validity = evaluateTrialValidity({
      generatorLag: normalLag,
      generatorEventLoopDelay: normalDelay,
      workerEventLoopDelays: { 'backend-node': badDelay },
      limits: { maxP99EventLoopDelayMs: 100 },
    });
    expect(validity.valid).toBe(false);
    expect(validity.reason).toContain("Worker node 'backend-node' event loop delay p99");
  });
});
