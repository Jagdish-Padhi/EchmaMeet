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

describe('Hindi and Hinglish commands (Gnani Prisma transcripts)', () => {
  const nodes = [
    { id: 'gateway', label: 'API Gateway' },
    { id: 'backend', label: 'Backend Service' },
    { id: 'database', label: 'Database Ledger' },
  ];
  const edges = [
    { id: 'edge-gw-be', source: 'gateway', target: 'backend' },
    { id: 'edge-be-db', source: 'backend', target: 'database' },
  ];

  it('injects latency from a Hinglish transcript with digits', () => {
    const r = parseVoiceIntent('gateway se backend par 300 ms latency inject karo', edges, nodes, {
      language: 'hi-IN',
    });
    expect(r.status).toBe('parsed');
    expect(r.command).toMatchObject({
      command: 'inject_fault',
      source: 'gateway',
      target: 'backend',
      faultType: 'latency',
    });
    expect(r.spokenReply).toContain('मिलीसेकंड');
    expect(r.language).toBe('hi-IN');
  });

  it('understands Devanagari service names and Hindi number words', () => {
    const r = parseVoiceIntent(
      'गेटवे से बैकएंड पर तीन सौ मिलीसेकंड लेटेंसी इंजेक्ट करो',
      edges,
      nodes,
      { language: 'hi-IN' },
    );
    expect(r.status).toBe('parsed');
    if (r.command?.command === 'inject_fault') expect(r.command.parameters?.latencyMs).toBe(300);
  });

  it('converts spoken seconds to milliseconds', () => {
    const r = parseVoiceIntent('inject latency 2 seconds from gateway to backend', edges, nodes);
    if (r.command?.command === 'inject_fault') expect(r.command.parameters?.latencyMs).toBe(2000);
    else throw new Error('expected inject_fault');
  });

  it('runs an experiment with Hindi trial count', () => {
    const r = parseVoiceIntent('५ ट्रायल के साथ एक्सपेरिमेंट चलाओ', edges, nodes);
    expect(r.command).toMatchObject({ command: 'run_experiment', trials: 5 });
    expect(r.spokenReply).toContain('केऑस प्रयोग');
  });

  it('starts repair and cancels in Hindi', () => {
    expect(parseVoiceIntent('रिपेयर शुरू करो', edges, nodes).command?.command).toBe('start_repair');
    expect(parseVoiceIntent('रोको', edges, nodes).command?.command).toBe('cancel');
    expect(parseVoiceIntent('experiment rok do', edges, nodes).command?.command).toBe('cancel');
  });

  it('loads a numbered scenario without being fooled by other digits', () => {
    const r = parseVoiceIntent('load scenario 3 with 500 trials', edges, nodes);
    expect(r.command).toMatchObject({ command: 'load_scenario', scenarioId: 'unbounded-queue' });
  });

  it('answers ambiguity and unsupported requests in the speaker language', () => {
    const amb = parseVoiceIntent('backend par latency inject karo', edges, nodes, {
      language: 'hi-IN',
    });
    expect(amb.status).toBe('ambiguous');
    expect(amb.spokenReply).toContain('कई लिंक');
    const none = parseVoiceIntent('मुझे पिज़्ज़ा चाहिए', edges, nodes, { language: 'hi-IN' });
    expect(none.status).toBe('unsupported');
    expect(none.command).toBeUndefined();
  });
});
