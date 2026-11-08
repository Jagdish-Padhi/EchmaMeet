import { describe, expect, it } from 'vitest';
import {
  MERMAID_TEMPLATES,
  parseMermaidArchitecture,
  sanitizeNodeId,
} from '../utils/mermaid-parser';

describe('mermaid-parser', () => {
  it('sanitizes raw strings into contract-compliant NodeIds', () => {
    expect(sanitizeNodeId('API Gateway')).toBe('api-gateway');
    expect(sanitizeNodeId('123-Service')).toBe('n-123-service');
    expect(sanitizeNodeId('___special&&&chars___')).toBe('special-chars');
  });

  it('parses standard flowchart with node shapes and edges', () => {
    const code = `
      graph TD
      gateway[API Gateway] --> auth[Auth Service]
      gateway --> orders[Order Service]
      orders --> inventory[(Inventory DB)]
      orders --> payment[Payment Gateway]
      payment --> ledger[(Ledger Sink)]
    `;

    const result = parseMermaidArchitecture(code);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.nodes.length).toBe(6);
      expect(result.edges.length).toBe(5);

      const gatewayNode = result.nodes.find((n) => n.id === 'gateway');
      expect(gatewayNode).toBeDefined();
      expect(gatewayNode?.kind).toBe('service');

      const inventoryNode = result.nodes.find((n) => n.id === 'inventory');
      expect(inventoryNode).toBeDefined();
      expect(inventoryNode?.kind).toBe('ledger_sink');

      // Verify layout coordinates exist and are non-negative
      expect(gatewayNode?.position.x).toBeGreaterThanOrEqual(100);
      expect(gatewayNode?.position.y).toBeGreaterThanOrEqual(100);
    }
  });

  it('parses queue workers and cache nodes properly', () => {
    const code = `
      flowchart LR
      ing[Ingress] --> q>Kafka Queue]
      q --> w[Worker]
      w --> c[(Redis Cache)]
    `;

    const result = parseMermaidArchitecture(code);
    expect(result.success).toBe(true);

    if (result.success) {
      const qNode = result.nodes.find((n) => n.id === 'q');
      expect(qNode?.kind).toBe('queue_consumer');

      const cNode = result.nodes.find((n) => n.id === 'c');
      expect(cNode?.kind).toBe('cache');
    }
  });

  it('handles chained edge arrows A --> B --> C', () => {
    const code = `
      graph LR
      a[Service A] --> b[Service B] --> c[Service C]
    `;

    const result = parseMermaidArchitecture(code);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nodes.length).toBe(3);
      expect(result.edges.length).toBe(2);
    }
  });

  it('all pre-packaged templates parse without error and satisfy contracts', () => {
    for (const template of MERMAID_TEMPLATES) {
      const result = parseMermaidArchitecture(template.code);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nodes.length).toBeGreaterThanOrEqual(template.nodeCount - 1);
        expect(result.edges.length).toBeGreaterThan(0);

        // Entry node must not be a queue_consumer
        const entry = result.nodes.find((n) => n.id === result.entryNodeId);
        expect(entry?.kind).not.toBe('queue_consumer');

        // All edges targeting a queue_consumer must be async_enqueue
        const nodeKindMap = new Map(result.nodes.map((n) => [n.id, n.kind]));
        for (const edge of result.edges) {
          const tgtKind = nodeKindMap.get(edge.target);
          if (tgtKind === 'queue_consumer') {
            expect(edge.mode).toBe('async_enqueue');
          } else {
            expect(edge.mode).toBe('sync_call');
          }
        }
      }
    }
  });

  it('automatically sets edge mode to async_enqueue when targeting a queue_consumer', () => {
    const code = `
      graph TD
      api[API Gateway] --> q>Kafka Broker]
    `;
    const result = parseMermaidArchitecture(code);
    expect(result.success).toBe(true);
    if (result.success) {
      const edge = result.edges.find((e) => e.target === 'q');
      expect(edge?.mode).toBe('async_enqueue');
    }
  });

  it('demotes ledger_sink with outgoing edges to service to prevent contract violations', () => {
    const code = `
      graph TD
      db[(Primary DB)] --> worker[Sync Worker]
    `;
    const result = parseMermaidArchitecture(code);
    expect(result.success).toBe(true);
    if (result.success) {
      const dbNode = result.nodes.find((n) => n.id === 'db');
      expect(dbNode?.kind).toBe('service');
    }
  });

  it('returns clean error message for empty input', () => {
    const result = parseMermaidArchitecture('   \n  \n ');
    expect(result.success).toBe(false);
  });
});
