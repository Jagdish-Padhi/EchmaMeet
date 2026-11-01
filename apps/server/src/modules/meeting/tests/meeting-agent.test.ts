import { describe, it, expect, vi } from 'vitest';
import { MeetingAgentService } from '../meeting-agent-service';
import type { Topology } from '@chaosboard/contracts';
import type { StructuredModelPort } from '../../meta-ai';

describe('MeetingAgentService', () => {
  it('returns clean zero-cost natural opinion when canvas is empty', async () => {
    const mockModel: StructuredModelPort = {
      generateStructured: vi.fn(),
    };

    const service = new MeetingAgentService(mockModel);
    const emptyTopology: Topology = {
      schemaVersion: 1,
      id: 'topo-1' as any,
      name: 'Empty',
      source: 'canvas',
      entry: { nodeId: 'auth' as any },
      nodes: [],
      edges: [],
    };

    const res = await service.evaluateMeetingContext(emptyTopology, 'Sarah Connor');

    expect(mockModel.generateStructured).not.toHaveBeenCalled();
    expect(res.handRaised).toBe(false);
    expect(res.spokenOpinion).toContain('Sarah Connor');
    expect(res.spokenOpinion).toContain("haven't drawn any services");
  });

  it('calls Meta LLM with structured distributed reasoning when nodes are present', async () => {
    const mockModel: StructuredModelPort = {
      generateStructured: vi.fn().mockResolvedValue({
        data: {
          handRaised: true,
          spokenOpinion: 'Sarah, your Auth service has unbounded retries to the database which could trigger a cascading failure.',
          hazards: [
            {
              id: 'hazard-1',
              title: 'Retry storm vulnerability',
              severity: 'critical',
              risk: 'Cascading retry storm under load',
              recommendation: 'Enable jitter and circuit breaker',
            },
          ],
        },
        rawOutput: '{}',
        metadata: {
          provider: 'meta_llama',
          modelId: 'llama-3.3-70b-versatile',
          promptVersion: 'v1',
          latencyMs: 120,
          tokenCounts: { promptTokens: 180, completionTokens: 60 },
        },
      }),
    };

    const service = new MeetingAgentService(mockModel);
    const topology: Topology = {
      schemaVersion: 1,
      id: 'topo-1' as any,
      name: 'Test',
      source: 'canvas',
      entry: { nodeId: 'auth' as any },
      nodes: [
        {
          id: 'auth' as any,
          label: 'Auth Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    };

    const res = await service.evaluateMeetingContext(topology, 'Sarah');

    expect(mockModel.generateStructured).toHaveBeenCalledTimes(1);
    expect(res.handRaised).toBe(true);
    expect(res.hazards.length).toBe(1);
    expect(res.spokenOpinion).toContain('Sarah');
  });
});

