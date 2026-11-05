import { describe, expect, it } from 'vitest';
import { parseVoiceIntent } from '../domain/intent-parser';

describe('voice intent-parser domain', () => {
  const nodes = [
    { id: 'gateway', label: 'API Gateway' },
    { id: 'backend', label: 'Backend Service' },
    { id: 'database', label: 'Database Ledger' },
  ];

  const edges = [
    { id: 'edge-gw-be', source: 'gateway', target: 'backend' },
    { id: 'edge-be-db', source: 'backend', target: 'database' },
  ];

  it('parses fault injection command with latency parameters', () => {
    const result = parseVoiceIntent('inject latency 400ms from gateway to backend', edges, nodes);
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('inject_fault');
    if (result.command && result.command.command === 'inject_fault') {
      expect(result.command.source).toBe('gateway');
      expect(result.command.target).toBe('backend');
      expect(result.command.parameters?.latencyMs).toBe(400);
    }
    expect(result.plainTextConfirmation).toContain('gateway -> backend');
  });

  it('parses invariant setting command', () => {
    const result = parseVoiceIntent(
      'set invariant completion rate at least 95 percent',
      edges,
      nodes,
    );
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('set_invariant');
    if (result.command && result.command.command === 'set_invariant') {
      expect(result.command.metric).toBe('completion_rate');
      expect(result.command.comparator).toBe('gte');
      expect(result.command.threshold).toBe(95);
    }
  });

  it('parses run experiment command with custom trials', () => {
    const result = parseVoiceIntent('run experiment with 7 trials', edges, nodes);
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('run_experiment');
    if (result.command && result.command.command === 'run_experiment') {
      expect(result.command.trials).toBe(7);
    }
  });

  it('parses start repair command with model proposer', () => {
    const result = parseVoiceIntent('start repair with model proposer', edges, nodes);
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('start_repair');
    if (result.command && result.command.command === 'start_repair') {
      expect(result.command.proposer).toBe('model');
    }
  });

  it('parses cancel command', () => {
    const result = parseVoiceIntent('cancel active run', edges, nodes);
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('cancel');
  });

  it('surfaces ambiguous command explicitly when target is unclear', () => {
    const result = parseVoiceIntent('inject latency on backend', edges, nodes);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toContain('edge-gw-be');
    expect(result.candidates).toContain('edge-be-db');
  });

  it('rejects unsupported command safely without hallucinations', () => {
    const result = parseVoiceIntent('order a pepperoni pizza', edges, nodes);
    expect(result.status).toBe('unsupported');
    expect(result.command).toBeUndefined();
    expect(result.message).toContain('Unsupported command');
  });
});
