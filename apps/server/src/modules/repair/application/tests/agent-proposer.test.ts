import { describe, expect, it } from 'vitest';
import { topologySchema, type RunRecord } from '@chaosboard/contracts';
import { AgentRepairProposer } from '../proposers/agent-proposer';
import { ModelRepairProposer } from '../proposers/model-proposer';
import type {
  ToolCall,
  ToolCapableModelPort,
  ToolChatOptions,
  ToolChatResult,
} from '../../../meta-ai';

const topology = topologySchema.parse({
  schemaVersion: 1,
  id: 't-agent',
  name: 'Agent Topo',
  source: 'scenario',
  entry: { nodeId: 'svc-a' },
  nodes: ['svc-a', 'svc-b'].map((id) => ({
    id,
    label: id,
    kind: 'service',
    processing: { distribution: 'constant', ms: 5 },
    concurrency: { maxWorkers: 10 },
    queue: { mode: 'bounded', maxDepth: 50 },
    ingressRateLimitRps: null,
  })),
  edges: [
    {
      id: 'a-to-b',
      source: 'svc-a',
      target: 'svc-b',
      mode: 'sync_call',
      policy: {
        timeoutMs: 2000,
        retry: {
          maxAttempts: 5,
          backoffBaseMs: 0,
          backoffMultiplier: 1,
          maxBackoffMs: 0,
          jitter: 'none',
        },
        breaker: {
          enabled: false,
          failureThresholdPct: 50,
          windowRequests: 20,
          cooldownMs: 5000,
          halfOpenProbes: 1,
        },
        fallback: 'fail_fast_503',
        idempotency: { sendKey: false },
        pool: { maxConnections: 10 },
      },
    },
  ],
});

const record = {
  id: 'run-1',
  status: 'completed',
  overallStatus: 'VIOLATED',
  topology,
  verdicts: [],
  baselineAggregate: null,
  faultedAggregate: null,
  invariants: [],
} as unknown as RunRecord;

const validPatch = {
  schemaVersion: 1,
  hypothesis: 'Five un-jittered retries multiply offered load during the latency fault.',
  operations: [
    {
      op: 'set_retry',
      edgeId: 'a-to-b',
      maxAttempts: 2,
      backoffBaseMs: 100,
      backoffMultiplier: 2,
      maxBackoffMs: 1000,
      jitter: 'full',
      rationale: 'retries amplify load 5x under the measured latency fault',
    },
  ],
};

/** Scripted model: each entry is the set of tool calls it makes on that turn. */
function scripted(turns: ToolCall[][]): ToolCapableModelPort & { seen: ToolChatOptions[] } {
  const seen: ToolChatOptions[] = [];
  let i = 0;
  return {
    seen,
    chatWithTools(options: ToolChatOptions): Promise<ToolChatResult> {
      seen.push({ ...options, messages: [...options.messages] });
      const calls = turns[i] ?? [];
      i += 1;
      return Promise.resolve({
        content: null,
        toolCalls: calls,
        metadata: {
          provider: 'meta',
          modelId: 'muse-spark-1.3',
          promptVersion: 'test',
          latencyMs: 10,
          tokenCounts: { promptTokens: 100, completionTokens: 20 },
        },
      });
    },
  };
}

describe('AgentRepairProposer', () => {
  it('inspects real state through tools, then submits a validated patch', async () => {
    const model = scripted([
      [{ id: '1', name: 'get_edge_policy', arguments: { edgeId: 'a-to-b' } }],
      [{ id: '2', name: 'get_failed_attempts', arguments: {} }],
      [{ id: '3', name: 'submit_patch', arguments: validPatch }],
    ]);
    const result = await new AgentRepairProposer(model).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.error).toBeUndefined();
    expect(result.mode).toBe('tool_agent');
    expect(result.patch?.operations[0]?.op).toBe('set_retry');
    expect(result.trace?.map((t) => t.tool)).toEqual([
      'get_edge_policy',
      'get_failed_attempts',
      'submit_patch',
    ]);
    // The tool result handed back to the model is computed from the real topology.
    const toolMessage = model.seen[1]?.messages.find((m) => m.role === 'tool');
    expect(toolMessage && 'content' in toolMessage ? toolMessage.content : '').toContain(
      '"maxAttempts":5',
    );
    // Token usage is aggregated across turns for exact cost accounting.
    expect(result.metadata?.tokenCounts).toEqual({ promptTokens: 300, completionTokens: 60 });
  });

  it('feeds validation problems back so the agent can correct itself', async () => {
    const bad = {
      ...validPatch,
      operations: [{ ...validPatch.operations[0], edgeId: 'does-not-exist' }],
    };
    const model = scripted([
      [{ id: '1', name: 'submit_patch', arguments: bad }],
      [{ id: '2', name: 'submit_patch', arguments: validPatch }],
    ]);
    const result = await new AgentRepairProposer(model).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.patch).not.toBeNull();
    const feedback = model.seen[1]?.messages.filter((m) => m.role === 'tool').at(-1);
    expect(feedback && 'content' in feedback ? feedback.content : '').toContain('"accepted":false');
  });

  it('exposes earlier rejected attempts so the agent does not repeat them', async () => {
    const model = scripted([
      [{ id: '1', name: 'get_failed_attempts', arguments: {} }],
      [{ id: '2', name: 'submit_patch', arguments: validPatch }],
    ]);
    await new AgentRepairProposer(model).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 1,
      history: [
        {
          iterationIndex: 0,
          decision: 'rollback',
          decisionReason: 'p99 regressed',
          patch: validPatch,
          validation: { valid: true, problems: [] },
        },
      ] as never,
    });
    const tool = model.seen[1]?.messages.find((m) => m.role === 'tool');
    const content = tool && 'content' in tool ? tool.content : '';
    expect(content).toContain('rollback');
    expect(content).toContain('p99 regressed');
  });

  it('reports failure honestly when the agent never submits', async () => {
    const result = await new AgentRepairProposer(scripted([[], [], []]), { maxTurns: 3 }).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.patch).toBeNull();
    expect(result.error).toMatch(/did not submit/);
  });

  it('surfaces provider errors instead of returning an empty patch silently', async () => {
    const failing: ToolCapableModelPort = {
      chatWithTools: () => Promise.reject(new Error('HTTP 429 rate limited')),
    };
    const result = await new AgentRepairProposer(failing).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.patch).toBeNull();
    expect(result.error).toContain('429');
  });
});

describe('AgentRepairProposer + Random Forest second opinion', () => {
  const aggregate = {
    trialsCount: 5,
    validTrialsCount: 5,
    invalidTrialsCount: 0,
    invalidReasons: [],
    metrics: {
      p50LatencyMs: { median: 350, p25: 300, p75: 400, iqr: 100 },
      p99LatencyMs: { median: 2800, p25: 2500, p75: 3100, iqr: 600 },
      completionRate: { median: 0.55, p25: 0.5, p75: 0.6, iqr: 0.1 },
      retryAmplification: { 'a-to-b': { median: 1.05, p25: 1.0, p75: 1.1, iqr: 0.1 } },
      workerSaturation: { 'svc-a': { median: 0.99, p25: 0.95, p75: 1.0, iqr: 0.05 } },
      maxQueueDepth: { 'svc-a': { median: 90, p25: 80, p75: 100, iqr: 20 } },
      duplicateWriteRate: { median: 0, p25: 0, p75: 0, iqr: 0 },
      breakerOpenFraction: { 'a-to-b': { median: 0, p25: 0, p75: 0, iqr: 0 } },
    },
  };

  it('lets the agent consult the trained classifier, computed from the measured aggregate', async () => {
    const model = scripted([
      [{ id: '1', name: 'get_ml_diagnosis', arguments: {} }],
      [{ id: '2', name: 'submit_patch', arguments: validPatch }],
    ]);
    const measured = { ...record, faultedAggregate: aggregate } as unknown as RunRecord;
    const result = await new AgentRepairProposer(model).propose({
      topology,
      record: measured,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.patch).not.toBeNull();
    const reply = model.seen[1]?.messages.find((m) => m.role === 'tool');
    const content = reply && 'content' in reply ? reply.content : '';
    expect(content).toContain('MISSING_TIMEOUT_CASCADE');
    expect(content).toContain('probabilities');
  });

  it('says so, instead of diagnosing invented numbers, when there is no measured telemetry', async () => {
    const model = scripted([
      [{ id: '1', name: 'get_ml_diagnosis', arguments: {} }],
      [{ id: '2', name: 'submit_patch', arguments: validPatch }],
    ]);
    await new AgentRepairProposer(model).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    const reply = model.seen[1]?.messages.find((m) => m.role === 'tool');
    expect(reply && 'content' in reply ? reply.content : '').toContain('No measured telemetry');
  });
});

describe('ModelRepairProposer degradation', () => {
  it('falls back to a single structured call, labelled as such, when tools are rejected', async () => {
    const model = {
      chatWithTools: () => Promise.reject(new Error('HTTP error 400: tools not supported')),
      generateStructured: () =>
        Promise.resolve({
          data: validPatch,
          rawOutput: '{}',
          metadata: { provider: 'meta', modelId: 'm', promptVersion: 'repair-v1', latencyMs: 1 },
        }),
    };
    const result = await new ModelRepairProposer(model as never).propose({
      topology,
      record,
      invariants: [],
      iterationIndex: 0,
    });
    expect(result.mode).toBe('single_shot');
    expect(result.patch).not.toBeNull();
  });
});
