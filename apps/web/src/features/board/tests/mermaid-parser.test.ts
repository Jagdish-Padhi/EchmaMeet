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

  it('all pre-packaged templates parse without error', () => {
    for (const template of MERMAID_TEMPLATES) {
      const result = parseMermaidArchitecture(template.code);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nodes.length).toBeGreaterThan(1);
        expect(result.edges.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns clean error message for empty input', () => {
    const result = parseMermaidArchitecture('   \n  \n ');
    expect(result.success).toBe(false);
  });
});
