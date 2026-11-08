import {
  edgeIdSchema,
  nodeIdSchema,
  type EdgePolicy,
  type NodeId,
  type NodeKind,
  type TopologyEdge,
} from '@chaosboard/contracts';
import type { BoardNode } from '../types';

const defaultEdgePolicy: EdgePolicy = {
  timeoutMs: 1000,
  retry: {
    maxAttempts: 2,
    backoffBaseMs: 50,
    backoffMultiplier: 2,
    maxBackoffMs: 500,
    jitter: 'full',
  },
  breaker: {
    enabled: false,
    failureThresholdPct: 50,
    windowRequests: 20,
    cooldownMs: 2000,
    halfOpenProbes: 2,
  },
  fallback: 'fail_fast_503',
  idempotency: { sendKey: false },
  pool: { maxConnections: 50 },
};

export interface MermaidParseSuccess {
  readonly success: true;
  readonly nodes: readonly BoardNode[];
  readonly edges: readonly TopologyEdge[];
  readonly entryNodeId: NodeId;
}

export interface MermaidParseFailure {
  readonly success: false;
  readonly error: string;
}

export type MermaidParseResult = MermaidParseSuccess | MermaidParseFailure;

/**
 * Sanitize any arbitrary string into a valid NodeId satisfying /^[a-z][a-z0-9-]{0,31}$/
 */
export function sanitizeNodeId(raw: string, fallbackIndex = 1): NodeId {
  let cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

  if (!cleaned || !/^[a-z]/.test(cleaned)) {
    cleaned = `n-${cleaned || String(fallbackIndex)}`;
  }
  const parsed = nodeIdSchema.safeParse(cleaned.slice(0, 32));
  if (parsed.success) {
    return parsed.data;
  }
  return nodeIdSchema.parse(`node-${String(fallbackIndex)}`);
}

/**
 * Infer node kind from Mermaid bracket syntax or label heuristics
 */
function inferNodeKind(shape: string, label: string, rawId: string): NodeKind {
  const combined = `${label} ${rawId}`.toLowerCase();

  if (combined.includes('cache') || combined.includes('redis') || combined.includes('memcached')) {
    return 'cache';
  }
  if (
    shape === '>]' ||
    combined.includes('queue') ||
    combined.includes('kafka') ||
    combined.includes('sqs') ||
    combined.includes('worker') ||
    combined.includes('consumer') ||
    combined.includes('pubsub')
  ) {
    return 'queue_consumer';
  }
  if (
    shape === '[(' ||
    combined.includes('ledger') ||
    combined.includes('sink') ||
    combined.includes('audit') ||
    combined.includes('journal') ||
    combined.includes('db') ||
    combined.includes('database') ||
    combined.includes('postgres') ||
    combined.includes('mysql') ||
    combined.includes('storage')
  ) {
    return 'ledger_sink';
  }
  return 'service';
}

interface RawNodeDef {
  readonly rawId: string;
  readonly label: string;
  readonly shape: string;
}

interface RawEdgeDef {
  readonly source: string;
  readonly target: string;
}

function parseNodeDecl(token: string): RawNodeDef | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // 1. Cylinder: id[(label)]
  let m = /^([a-zA-Z0-9_-]+)\s*\[\((.+?)\)\]$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '[(' };

  // 2. Queue: id>label]
  m = /^([a-zA-Z0-9_-]+)\s*>(.+?)\]$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '>]' };

  // 3. Stadium: id([label])
  m = /^([a-zA-Z0-9_-]+)\s*\(\[(.+?)\]\)$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '([' };

  // 4. Subroutine: id[[label]]
  m = /^([a-zA-Z0-9_-]+)\s*\[\[(.+?)\]\]$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '[[' };

  // 5. Circle: id((label))
  m = /^([a-zA-Z0-9_-]+)\s*\(\((.+?)\)\)$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '((' };

  // 6. Box: id[label]
  m = /^([a-zA-Z0-9_-]+)\s*\[(.+?)\]$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '[' };

  // 7. Rhombus: id{label}
  m = /^([a-zA-Z0-9_-]+)\s*\{(.+?)\}$/.exec(trimmed);
  if (m && m[1] && m[2]) return { rawId: m[1], label: m[2].trim(), shape: '{' };

  // 8. Plain ID: id
  m = /^([a-zA-Z0-9_-]+)$/.exec(trimmed);
  if (m && m[1]) return { rawId: m[1], label: m[1], shape: 'bare' };

  return null;
}

/**
 * Parse standard Mermaid architecture flowchart syntax into EchmaMeet board topology
 */
export function parseMermaidArchitecture(mermaidCode: string): MermaidParseResult {
  const lines = mermaidCode
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (lines.length === 0) {
    return { success: false, error: 'Empty Mermaid diagram input.' };
  }

  const rawNodes = new Map<string, RawNodeDef>();
  const rawEdges: RawEdgeDef[] = [];

  const arrowSplitRegex = /\s*(?:-->\|[^|]*\||--[^->\n]+-->|-->|==>|-\.->|---|--)\s*/;

  for (const line of lines) {
    // Skip chart orientation declarations
    if (/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i.test(line)) {
      continue;
    }

    const parts = line.split(arrowSplitRegex);

    if (parts.length > 1) {
      // Line contains edge(s) connecting nodes
      const decls: RawNodeDef[] = [];
      for (const part of parts) {
        const decl = parseNodeDecl(part);
        if (decl) {
          decls.push(decl);
          if (!rawNodes.has(decl.rawId) || rawNodes.get(decl.rawId)?.shape === 'bare') {
            rawNodes.set(decl.rawId, decl);
          }
        }
      }

      for (let i = 0; i < decls.length - 1; i++) {
        const src = decls[i];
        const tgt = decls[i + 1];
        if (src && tgt && src.rawId !== tgt.rawId) {
          rawEdges.push({ source: src.rawId, target: tgt.rawId });
        }
      }
    } else {
      // Standalone node declaration
      const decl = parseNodeDecl(line);
      if (decl) {
        if (!rawNodes.has(decl.rawId) || rawNodes.get(decl.rawId)?.shape === 'bare') {
          rawNodes.set(decl.rawId, decl);
        }
      }
    }
  }

  if (rawNodes.size === 0) {
    return {
      success: false,
      error:
        'No valid nodes or connections detected. Ensure standard Mermaid syntax (e.g. A[Gateway] --> B[Auth]).',
    };
  }

  // Map raw IDs to sanitized NodeIds
  const idMap = new Map<string, NodeId>();
  let idx = 1;
  for (const rawId of rawNodes.keys()) {
    idMap.set(rawId, sanitizeNodeId(rawId, idx++));
  }

  // Build DAG layers for automatic clean layout coordinates
  const inDegree = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();

  for (const rawId of rawNodes.keys()) {
    inDegree.set(rawId, 0);
    childrenMap.set(rawId, []);
  }

  for (const edge of rawEdges) {
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    const children = childrenMap.get(edge.source);
    if (children) {
      children.push(edge.target);
    }
  }

  // Calculate topological levels
  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [rawId, deg] of inDegree.entries()) {
    if (deg === 0) {
      levels.set(rawId, 0);
      queue.push(rawId);
    }
  }

  // If no root found (cycle), pick the first node
  if (queue.length === 0) {
    const firstKey = rawNodes.keys().next().value;
    if (firstKey) {
      levels.set(firstKey, 0);
      queue.push(firstKey);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (!current) continue;
    const currentLevel = levels.get(current) ?? 0;
    const children = childrenMap.get(current) ?? [];

    for (const child of children) {
      const existing = levels.get(child);
      if (existing === undefined || existing < currentLevel + 1) {
        levels.set(child, currentLevel + 1);
        if (!queue.includes(child)) {
          queue.push(child);
        }
      }
    }
  }

  // Assign levels to any remaining disconnected nodes
  for (const rawId of rawNodes.keys()) {
    if (!levels.has(rawId)) {
      levels.set(rawId, 0);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const [rawId, level] of levels.entries()) {
    const group = layerGroups.get(level) ?? [];
    group.push(rawId);
    layerGroups.set(level, group);
  }

  // Generate BoardNode array with coordinates
  const nodes: BoardNode[] = [];
  for (const [level, group] of layerGroups.entries()) {
    group.forEach((rawId, indexInLayer) => {
      const def = rawNodes.get(rawId);
      const sanitizedId = idMap.get(rawId);
      if (!def || !sanitizedId) return;
      let kind = inferNodeKind(def.shape, def.label, def.rawId);

      // Sinks cannot have outgoing edges per preflight rules; demote to service if it acts as a caller
      if (kind === 'ledger_sink' && childrenMap.get(rawId)?.length) {
        kind = 'service';
      }

      const baseProps = {
        id: sanitizedId,
        label: def.label,
        processing: {
          distribution: 'constant' as const,
          ms: kind === 'cache' ? 2 : kind === 'ledger_sink' ? 25 : 12,
        },
        concurrency: { maxWorkers: kind === 'ledger_sink' ? 5 : 15 },
        queue: { mode: 'bounded' as const, maxDepth: 50 },
        ingressRateLimitRps: null,
        position: {
          x: 100 + level * 260,
          y: 100 + indexInLayer * 140,
        },
      };

      if (kind === 'cache') {
        nodes.push({ ...baseProps, kind: 'cache', ttlMs: 60000 });
      } else if (kind === 'queue_consumer') {
        nodes.push({ ...baseProps, kind: 'queue_consumer', consumeRateRps: 50 });
      } else if (kind === 'ledger_sink') {
        nodes.push({ ...baseProps, kind: 'ledger_sink', dedupeByKey: true });
      } else {
        nodes.push({ ...baseProps, kind: 'service' });
      }
    });
  }

  // Pre-index node kind by sanitized id for edge configuration
  const nodeKindById = new Map<NodeId, NodeKind>();
  for (const n of nodes) {
    nodeKindById.set(n.id, n.kind);
  }

  // Generate TopologyEdges
  const edges: TopologyEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const rawEdge of rawEdges) {
    const srcId = idMap.get(rawEdge.source);
    const tgtId = idMap.get(rawEdge.target);

    if (srcId && tgtId && srcId !== tgtId) {
      const key = `${srcId}->${tgtId}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        const parsedEdgeId = edgeIdSchema.safeParse(`${srcId}-to-${tgtId}`);
        const edgeId = parsedEdgeId.success
          ? parsedEdgeId.data
          : edgeIdSchema.parse(`e-${srcId.slice(0, 14)}-${tgtId.slice(0, 14)}`);

        // Contract Rule: If target is a queue_consumer, edge mode MUST be async_enqueue!
        const targetKind = nodeKindById.get(tgtId);
        const edgeMode = targetKind === 'queue_consumer' ? 'async_enqueue' : 'sync_call';

        edges.push({
          id: edgeId,
          source: srcId,
          target: tgtId,
          mode: edgeMode,
          policy: defaultEdgePolicy,
        });
      }
    }
  }

  // Find valid entry node (must be reachable root and not a queue_consumer)
  const candidateEntry = nodes.find((n) => {
    const rawKey = [...idMap.entries()].find(([, sId]) => sId === n.id)?.[0];
    return rawKey && (inDegree.get(rawKey) ?? 0) === 0 && n.kind === 'service';
  });

  const initialEntry =
    candidateEntry ??
    nodes.find((n) => n.kind === 'service') ??
    nodes.find((n) => n.kind !== 'queue_consumer') ??
    nodes[0];

  if (!initialEntry) {
    return {
      success: false,
      error: 'Failed to generate nodes from diagram.',
    };
  }

  // Contract rule: Entry node cannot be queue_consumer
  let finalEntry: BoardNode = initialEntry;
  if (finalEntry.kind === 'queue_consumer') {
    finalEntry = { ...finalEntry, kind: 'service' };
    const idxInList = nodes.findIndex((n) => n.id === finalEntry.id);
    if (idxInList !== -1) {
      nodes[idxInList] = finalEntry;
    }
  }

  const entryNodeId = finalEntry.id;

  return {
    success: true,
    nodes,
    edges,
    entryNodeId,
  };
}

export interface ArchitectureTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly highlights: readonly string[];
  readonly code: string;
}

export const MERMAID_TEMPLATES: readonly ArchitectureTemplate[] = [
  {
    id: 'aws-microservices',
    name: 'AWS Cloud-Native Microservices',
    category: 'Cloud Native',
    description:
      'Multi-tier production architecture with Edge ALB ingress, Auth caching, Order microservice, PostgreSQL primary, and Payment Gateway with Financial Ledger.',
    nodeCount: 7,
    highlights: ['Redis Session Cache', 'PostgreSQL DB Sink', 'Financial Ledger Sink'],
    code: `graph TD
  alb[Edge Application Load Balancer] --> auth[Auth Service]
  alb --> orders[Order Microservice]
  auth --> session[(Redis Session Cache)]
  orders --> catalog[Product Catalog Service]
  orders --> payment[Payment Service]
  catalog --> db[(PostgreSQL Primary DB)]
  payment --> ledger[(Financial Ledger Sink)]`,
  },
  {
    id: 'event-driven-saga',
    name: 'Event-Driven Saga with Kafka & DLQ',
    category: 'Event-Driven',
    description:
      'Choreographed event-driven orchestration with an Ingress Dispatcher, Kafka Event Bus, async fulfillment workers, notification dispatchers, Redis state, and Immutable Audit Sink.',
    nodeCount: 7,
    highlights: ['Kafka Async Broker', 'Worker Pool Consumers', 'Immutable Audit Sink'],
    code: `graph TD
  gateway[API Gateway Ingress] --> dispatcher[Event Dispatcher]
  dispatcher --> kafka>Kafka Event Broker]
  kafka --> fulfillment>Fulfillment Worker]
  kafka --> notifications>Notification Consumer]
  fulfillment --> state[(Redis Cluster State)]
  fulfillment --> audit[(Immutable Audit Sink)]`,
  },
  {
    id: 'fintech-ledger',
    name: 'FinTech Real-Time Payment Ledger',
    category: 'FinTech & Banking',
    description:
      'Zero-loss transactional banking pipeline featuring ML Fraud Risk scoring, Redis Idempotency Deduplication, settlement routing, and immutable double-entry ledger sinks.',
    nodeCount: 6,
    highlights: ['Idempotency Store', 'Fraud & Risk Engine', 'Double-Entry Core Ledger'],
    code: `graph TD
  ingress[Payment API Gateway] --> fraud[Risk & Fraud Engine]
  fraud --> dedup[(Redis Idempotency Store)]
  fraud --> settlement[Settlement Router]
  settlement --> clearing>Clearing Queue Consumer]
  settlement --> core[(Core Banking Ledger Sink)]`,
  },
  {
    id: 'k8s-resilient-mesh',
    name: 'Kubernetes Ingress & Resilient Mesh',
    category: 'Kubernetes',
    description:
      'Decoupled cloud-native service mesh with Envoy Ingress routing, user service caching, transactional checkout, payment proxy, and persistent database sinks.',
    nodeCount: 7,
    highlights: ['Envoy Ingress Mesh', 'Redis Distributed Cache', 'Decoupled Microservices'],
    code: `graph LR
  ingress[Envoy Ingress Controller] --> web[Web API Gateway]
  web --> cache[(Redis Distributed Cache)]
  web --> user[User Account Service]
  web --> checkout[Checkout Service]
  user --> accounts[(PostgreSQL User DB)]
  checkout --> payments[Payment Gateway Service]
  payments --> records[(Transaction Ledger Sink)]`,
  },
  {
    id: 'streaming-telemetry',
    name: 'High-Throughput Streaming & Telemetry',
    category: 'Streaming & IoT',
    description:
      'Large-scale telemetry ingestion pipeline with bounded stream buffering, distributed aggregation worker pool, hot Redis metrics cache, and long-term object storage.',
    nodeCount: 5,
    highlights: ['Ingestion Buffer Queue', 'Aggregation Workers', 'TimeSeries Object Sink'],
    code: `graph TD
  collector[Telemetry Ingress Collector] --> ingest>Ingestion Stream Buffer]
  ingest --> aggregator>Stream Worker Pool]
  aggregator --> hotcache[(Redis Metrics Cache)]
  aggregator --> storage[(Long-term Object Storage Sink)]`,
  },
];
