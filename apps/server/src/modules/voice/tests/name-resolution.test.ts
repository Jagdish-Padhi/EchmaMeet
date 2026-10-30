import { describe, expect, it } from 'vitest';
import { resolveEdgeFromSpokenText } from '../domain/name-resolution';

describe('voice name-resolution domain', () => {
  const nodes = [
    { id: 'gateway', label: 'API Gateway' },
    { id: 'backend', label: 'Backend Service' },
    { id: 'database', label: 'Database Ledger' },
  ];

  const edges = [
    { id: 'edge-gw-be', source: 'gateway', target: 'backend' },
    { id: 'edge-be-db', source: 'backend', target: 'database' },
  ];

  it('resolves exact edge when source and target are named', () => {
    const result = resolveEdgeFromSpokenText(
      'inject delay between gateway and backend',
      edges,
      nodes,
    );
    expect(result.status).toBe('exact');
    expect(result.edge?.id).toBe('edge-gw-be');
  });

  it('detects ambiguous edge when a node connects to multiple edges', () => {
    const result = resolveEdgeFromSpokenText('break backend', edges, nodes);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
    expect(result.message).toContain('connects to 2 edges');
  });

  it('returns none when edge cannot be resolved', () => {
    const result = resolveEdgeFromSpokenText('break redis cache', edges, nodes);
    expect(result.status).toBe('none');
    expect(result.candidates).toHaveLength(0);
  });
});
