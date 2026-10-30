import { useCallback, useEffect, useRef, useState } from 'react';
import {
  edgeIdSchema,
  nodeIdSchema,
  type EdgeId,
  type EdgePolicy,
  type NodeId,
  type NodeKind,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from '@chaosboard/contracts';
import type { ApiClient } from '../../../api/client';
import { fromTopology, toTopology, type BoardNode, type BoardState } from '../types';

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

export interface NodePresetConfig {
  readonly label?: string;
  readonly processingMs?: number;
  readonly maxWorkers?: number;
  readonly ttlMs?: number;
  readonly consumeRateRps?: number;
  readonly dedupeByKey?: boolean;
}

export function useBoardState(initialTopology: Topology | null, api: ApiClient) {
  const [board, setBoard] = useState<BoardState>(() => {
    if (initialTopology) {
      return fromTopology(initialTopology);
    }
    const gatewayId = nodeIdSchema.parse('gateway');
    return {
      id: 'custom-topology',
      name: 'Custom Topology',
      entryNodeId: gatewayId,
      nodes: [
        {
          id: gatewayId,
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 100, y: 150 },
        },
      ],
      edges: [],
      selectedNodeId: gatewayId,
      selectedEdgeId: null,
      validationProblems: [],
      isValidating: false,
      isDirty: false,
    };
  });

  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerValidation = useCallback(
    (currentBoard: BoardState) => {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
      validateTimeoutRef.current = setTimeout(() => {
        setBoard((prev) => ({ ...prev, isValidating: true }));
        const topology = toTopology(currentBoard);
        api
          .validateTopology(topology)
          .then((result) => {
            setBoard((prev) => ({
              ...prev,
              isValidating: false,
              validationProblems: result.valid ? [] : result.problems,
            }));
          })
          .catch(() => {
            setBoard((prev) => ({ ...prev, isValidating: false }));
          });
      }, 300);
    },
    [api],
  );

  const loadTopology = useCallback(
    (topology: Topology) => {
      const newBoard = fromTopology(topology);
      setBoard(newBoard);
      triggerValidation(newBoard);
    },
    [triggerValidation],
  );

  const importDiagram = useCallback(
    (
      nodes: readonly BoardNode[],
      edges: readonly TopologyEdge[],
      entryNodeId: NodeId,
      name = 'Imported Architecture',
    ) => {
      setBoard((prev) => {
        const next: BoardState = {
          ...prev,
          id: `diag-${Date.now().toString(36)}`,
          name,
          entryNodeId,
          nodes: [...nodes],
          edges: [...edges],
          selectedNodeId: entryNodeId,
          selectedEdgeId: null,
          validationProblems: [],
          isValidating: false,
          isDirty: true,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const updateNodePosition = useCallback((nodeId: NodeId, x: number, y: number) => {
    setBoard((prev) => ({
      ...prev,
      isDirty: true,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)),
    }));
  }, []);

  const selectNode = useCallback((nodeId: NodeId | null) => {
    setBoard((prev) => ({ ...prev, selectedNodeId: nodeId, selectedEdgeId: null }));
  }, []);

  const selectEdge = useCallback((edgeId: EdgeId | null) => {
    setBoard((prev) => ({ ...prev, selectedEdgeId: edgeId, selectedNodeId: null }));
  }, []);

  const updateNode = useCallback(
    (nodeId: NodeId, patch: Partial<TopologyNode>) => {
      setBoard((prev) => {
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.map((n) => (n.id === nodeId ? ({ ...n, ...patch } as BoardNode) : n)),
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const updateEdgePolicy = useCallback(
    (edgeId: EdgeId, policy: EdgePolicy) => {
      setBoard((prev) => {
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, policy } : e)),
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const addNode = useCallback(
    (kind: NodeKind = 'service', preset?: NodePresetConfig) => {
      setBoard((prev) => {
        let count = prev.nodes.length + 1;
        let newIdStr = `node-${String(count)}`;
        while (prev.nodes.some((n) => n.id === newIdStr)) {
          count += 1;
          newIdStr = `node-${String(count)}`;
        }
        const newId = nodeIdSchema.parse(newIdStr);

        const defaultLabel =
          kind === 'queue_consumer'
            ? 'Queue Worker'
            : kind === 'ledger_sink'
              ? 'Ledger Sink'
              : kind === 'cache'
                ? 'Cache Store'
                : `Service ${String(count)}`;

        const baseProps = {
          id: newId,
          label: preset?.label ?? defaultLabel,
          processing: {
            distribution: 'constant' as const,
            ms: preset?.processingMs ?? (kind === 'cache' ? 2 : 15),
          },
          concurrency: {
            maxWorkers: preset?.maxWorkers ?? (kind === 'ledger_sink' ? 5 : 10),
          },
          queue: { mode: 'bounded' as const, maxDepth: 50 },
          ingressRateLimitRps: null,
          position: {
            x: 120 + (prev.nodes.length % 3) * 260,
            y: 120 + Math.floor(prev.nodes.length / 3) * 180,
          },
        };

        let newNode: BoardNode;
        if (kind === 'cache') {
          newNode = { ...baseProps, kind: 'cache', ttlMs: preset?.ttlMs ?? 60000 };
        } else if (kind === 'queue_consumer') {
          newNode = {
            ...baseProps,
            kind: 'queue_consumer',
            consumeRateRps: preset?.consumeRateRps ?? 50,
          };
        } else if (kind === 'ledger_sink') {
          newNode = { ...baseProps, kind: 'ledger_sink', dedupeByKey: preset?.dedupeByKey ?? true };
        } else {
          newNode = { ...baseProps, kind: 'service' };
        }
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: [...prev.nodes, newNode],
          selectedNodeId: newId,
          selectedEdgeId: null,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const removeNode = useCallback(
    (nodeId: NodeId) => {
      setBoard((prev) => {
        if (prev.nodes.length <= 1) return prev; // Cannot delete last node
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.filter((n) => n.id !== nodeId),
          edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: prev.selectedNodeId === nodeId ? null : prev.selectedNodeId,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const duplicateNode = useCallback(
    (nodeId: NodeId) => {
      setBoard((prev) => {
        const target = prev.nodes.find((n) => n.id === nodeId);
        if (!target) return prev;
        let count = prev.nodes.length + 1;
        let newId = nodeIdSchema.parse(`node-${String(count)}`);
        while (prev.nodes.some((n) => n.id === newId)) {
          count += 1;
          newId = nodeIdSchema.parse(`node-${String(count)}`);
        }
        const clonedNode: BoardNode = {
          ...target,
          id: newId,
          label: `${target.label} Copy`,
          position: {
            x: target.position.x + 36,
            y: target.position.y + 36,
          },
        };
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: [...prev.nodes, clonedNode],
          selectedNodeId: newId,
          selectedEdgeId: null,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const addEdge = useCallback(
    (source: NodeId, target: NodeId) => {
      setBoard((prev) => {
        const id = edgeIdSchema.parse(`${source}-to-${target}`);
        if (prev.edges.some((e) => e.id === id || (e.source === source && e.target === target))) {
          return prev;
        }
        const newEdge: TopologyEdge = {
          id,
          source,
          target,
          mode: 'sync_call',
          policy: defaultEdgePolicy,
        };
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: [...prev.edges, newEdge],
          selectedEdgeId: id,
          selectedNodeId: null,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const removeEdge = useCallback(
    (edgeId: EdgeId) => {
      setBoard((prev) => {
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: prev.edges.filter((e) => e.id !== edgeId),
          selectedEdgeId: prev.selectedEdgeId === edgeId ? null : prev.selectedEdgeId,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
    };
  }, []);

  return {
    board,
    loadTopology,
    importDiagram,
    updateNodePosition,
    selectNode,
    selectEdge,
    updateNode,
    updateEdgePolicy,
    addNode,
    duplicateNode,
    removeNode,
    addEdge,
    removeEdge,
  };
}
