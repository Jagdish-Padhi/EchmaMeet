import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EdgeId, RepairIterationRecord } from '@chaosboard/contracts';
import { IterationTimeline } from '../components/IterationTimeline';

describe('IterationTimeline component', () => {
  it('renders empty state when iterations is empty', () => {
    const html = renderToStaticMarkup(<IterationTimeline iterations={[]} />);
    expect(html).toContain('Iterations will appear here');
  });

  it('renders iteration record details including rationale, patch diff, and decision', () => {
    const iterations: readonly RepairIterationRecord[] = [
      {
        iterationIndex: 1,
        summarySent: 'summary',
        rawModelOutput: '{}',
        patch: {
          schemaVersion: 1,
          hypothesis:
            'Reduce retry attempts to halt amplification and increase timeout to prevent false aborts.',
          operations: [
            {
              op: 'set_timeout',
              edgeId: 'gateway->api' as EdgeId,
              timeoutMs: 1200,
              rationale: 'increase timeout',
            },
            {
              op: 'set_retry',
              edgeId: 'gateway->api' as EdgeId,
              maxAttempts: 1,
              backoffBaseMs: 50,
              backoffMultiplier: 2,
              maxBackoffMs: 500,
              jitter: 'full',
              rationale: 'reduce retries',
            },
          ],
        },
        validation: { valid: true, problems: [] },
        experimentRunId: null,
        verdicts: null,
        overallStatus: 'PASS',
        decision: 'accept',
        decisionReason: 'p99 latency improved by 77% with zero increase in error rate.',
        modelCallMetadata: {
          provider: 'openai-compatible',
          modelId: 'gnani-evon-v3.3',
          promptVersion: 'repair-v1',
          latencyMs: 420,
          tokenCounts: { promptTokens: 300, completionTokens: 120 },
        },
      },
    ];

    const html = renderToStaticMarkup(<IterationTimeline iterations={iterations} />);
    expect(html).toContain('Iteration #1');
    expect(html).toContain('Reduce retry attempts to halt amplification');
    expect(html).toContain('set_timeout');
    expect(html).toContain('gateway-&gt;api');
    expect(html).toContain('Tokens: 420');
    expect(html).toContain('ACCEPT');
    expect(html).toContain('p99 latency improved by 77%');
  });
});
