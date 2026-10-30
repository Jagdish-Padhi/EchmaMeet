import { useCallback, useEffect, useRef, useState } from 'react';
import {
  edgeIdSchema,
  nodeIdSchema,
  type EdgeId,
  type EdgePolicy,
  type NodeId,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from '@chaosboard/contracts';
import type { ApiClient } from '../../../api/client';
import { fromTopology, toTopologyDraft, type BoardNode, type BoardState } from '../types';

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
        const draft = toTopologyDraft(currentBoard);
        api
          .validateTopology(draft)
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

  const addNode = useCallback(() => {
    setBoard((prev) => {
      const newId = nodeIdSchema.parse(`node-${String(prev.nodes.length + 1)}`);
      const newNode: BoardNode = {
        id: newId,
        label: `Service ${String(prev.nodes.length + 1)}`,
        kind: 'service',
        processing: { distribution: 'constant', ms: 15 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
        position: {
          x: 100 + (prev.nodes.length % 3) * 260,
          y: 100 + Math.floor(prev.nodes.length / 3) * 180,
        },
      };
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
  }, [triggerValidation]);

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

  const addEdge = useCallback(
    (source: NodeId, target: NodeId) => {
      setBoard((prev) => {
        const id = edgeIdSchema.parse(`${source}->${target}`);
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
    updateNodePosition,
    selectNode,
    selectEdge,
    updateNode,
    updateEdgePolicy,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
  };
}
