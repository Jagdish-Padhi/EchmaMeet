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
import {
  fromTopology,
  toTopology,
  type BoardNode,
  type BoardState,
  type CanvasPosition,
  type CanvasStroke,
  type NodeMeta,
} from '../types';

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
  readonly meta?: NodeMeta;
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
          label: 'API Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 50 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: 1000,
          position: { x: 100, y: 150 },
          meta: {
            tier: 'tier-0',
            protocol: 'grpc',
            ownerTeam: 'Edge Traffic & Ingress',
            onCall: '#edge-oncall',
            slaP99Ms: 25,
            targetAvailability: '99.99%',
            notes: 'Ingress routing gateway for client traffic.',
          },
        },
      ],
      edges: [],
      selectedNodeId: gatewayId,
      selectedNodeIds: [gatewayId],
      selectedEdgeId: null,
      strokes: [],
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
          selectedNodeIds: [entryNodeId],
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

  const moveSelectedNodes = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    setBoard((prev) => {
      const selectedSet = new Set(
        prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []),
      );
      if (selectedSet.size === 0) return prev;
      return {
        ...prev,
        isDirty: true,
        nodes: prev.nodes.map((n) => {
          if (selectedSet.has(n.id)) {
            return {
              ...n,
              position: {
                x: Math.round(n.position.x + dx),
                y: Math.round(n.position.y + dy),
              },
            };
          }
          return n;
        }),
      };
    });
  }, []);

  const selectNode = useCallback((nodeId: NodeId | null) => {
    setBoard((prev) => ({
      ...prev,
      selectedNodeId: nodeId,
      selectedNodeIds: nodeId ? [nodeId] : [],
      selectedEdgeId: null,
    }));
  }, []);

  const selectNodes = useCallback((nodeIds: readonly NodeId[]) => {
    setBoard((prev) => ({
      ...prev,
      selectedNodeIds: [...nodeIds],
      selectedNodeId: nodeIds.length > 0 ? (nodeIds[0] ?? null) : null,
      selectedEdgeId: null,
    }));
  }, []);

  const selectEdge = useCallback((edgeId: EdgeId | null) => {
    setBoard((prev) => ({
      ...prev,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      selectedNodeIds: [],
    }));
  }, []);

  const setEntryNode = useCallback(
    (nodeId: NodeId) => {
      setBoard((prev) => {
        if (!prev.nodes.some((n) => n.id === nodeId)) return prev;
        const next: BoardState = {
          ...prev,
          entryNodeId: nodeId,
          isDirty: true,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const updateNode = useCallback(
    (nodeId: NodeId, patch: Partial<TopologyNode>, metaPatch?: Partial<NodeMeta>) => {
      setBoard((prev) => {
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            const updated = {
              ...n,
              ...patch,
              meta: metaPatch ? { ...(n.meta ?? {}), ...metaPatch } : n.meta,
            };
            const targetKind = patch.kind ?? n.kind;
            if (targetKind !== 'cache') {
              delete (updated as { ttlMs?: unknown }).ttlMs;
            }
            if (targetKind !== 'queue_consumer') {
              delete (updated as { consumeRateRps?: unknown }).consumeRateRps;
            }
            if (targetKind !== 'ledger_sink') {
              delete (updated as { dedupeByKey?: unknown }).dedupeByKey;
            }
            return updated as BoardNode;
          }),
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
          meta: preset?.meta ?? {
            tier: kind === 'ledger_sink' ? 'tier-0' : 'tier-1',
            protocol: kind === 'queue_consumer' ? 'kafka' : 'grpc',
            ownerTeam: 'Platform Engineering',
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
          selectedNodeIds: [newId],
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
          selectedNodeIds: (prev.selectedNodeIds ?? []).filter((id) => id !== nodeId),
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
        const baseLabel = target.label.replace(/\s*(Copy|\(\d+\))*$/gi, '').trim();
        const existingCount = prev.nodes.filter((n) => n.label.startsWith(baseLabel)).length;
        const newLabel =
          existingCount === 1 ? `${baseLabel} Copy` : `${baseLabel} (${String(existingCount)})`;

        const clonedNode: BoardNode = {
          ...target,
          id: newId,
          label: newLabel,
          position: {
            x: target.position.x + 40,
            y: target.position.y + 40,
          },
        };
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: [...prev.nodes, clonedNode],
          selectedNodeId: newId,
          selectedNodeIds: [newId],
          selectedEdgeId: null,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const duplicateSelected = useCallback(() => {
    setBoard((prev) => {
      const selectedIds =
        prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []);
      if (selectedIds.length === 0) return prev;

      const idMap = new Map<NodeId, NodeId>();
      let count = prev.nodes.length + 1;
      const newNodes: BoardNode[] = [];

      for (const oldId of selectedIds) {
        const target = prev.nodes.find((n) => n.id === oldId);
        if (!target) continue;

        let newIdStr = `node-${String(count)}`;
        while (prev.nodes.some((n) => n.id === newIdStr) || idMap.has(newIdStr as NodeId)) {
          count += 1;
          newIdStr = `node-${String(count)}`;
        }
        const newId = nodeIdSchema.parse(newIdStr);
        idMap.set(oldId, newId);

        const baseLabel = target.label.replace(/\s*(Copy|\(\d+\))*$/gi, '').trim();
        const existingCount = prev.nodes.filter((n) => n.label.startsWith(baseLabel)).length;
        const newLabel =
          existingCount === 1 ? `${baseLabel} Copy` : `${baseLabel} (${String(existingCount)})`;

        newNodes.push({
          ...target,
          id: newId,
          label: newLabel,
          position: {
            x: target.position.x + 40,
            y: target.position.y + 40,
          },
        });
      }

      // Replicate internal edges between the duplicated nodes
      const newEdges: TopologyEdge[] = [];
      for (const edge of prev.edges) {
        const newSource = idMap.get(edge.source);
        const newTarget = idMap.get(edge.target);
        if (newSource && newTarget) {
          const newEdgeId = edgeIdSchema.parse(`${newSource}-to-${newTarget}`);
          newEdges.push({
            ...edge,
            id: newEdgeId,
            source: newSource,
            target: newTarget,
          });
        }
      }

      const nextSelected = Array.from(idMap.values());
      const next: BoardState = {
        ...prev,
        isDirty: true,
        nodes: [...prev.nodes, ...newNodes],
        edges: [...prev.edges, ...newEdges],
        selectedNodeIds: nextSelected,
        selectedNodeId: nextSelected[0] ?? null,
        selectedEdgeId: null,
      };
      triggerValidation(next);
      return next;
    });
  }, [triggerValidation]);

  const deleteSelected = useCallback(() => {
    setBoard((prev) => {
      const selectedIds = new Set(
        prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []),
      );
      const edgeIdToDelete = prev.selectedEdgeId;

      if (selectedIds.size === 0 && !edgeIdToDelete) return prev;
      if (selectedIds.size >= prev.nodes.length && prev.nodes.length > 0) {
        // Prevent deleting every single node
        return prev;
      }

      const remainingNodes = prev.nodes.filter((n) => !selectedIds.has(n.id));
      const remainingEdges = prev.edges.filter(
        (e) => !selectedIds.has(e.source) && !selectedIds.has(e.target) && e.id !== edgeIdToDelete,
      );

      const next: BoardState = {
        ...prev,
        isDirty: true,
        nodes: remainingNodes,
        edges: remainingEdges,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
      triggerValidation(next);
      return next;
    });
  }, [triggerValidation]);

  const alignSelected = useCallback((direction: 'left' | 'top' | 'distribute') => {
    setBoard((prev) => {
      const selectedIds = new Set(
        prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []),
      );
      if (selectedIds.size < 2) return prev;

      const selected = prev.nodes.filter((n) => selectedIds.has(n.id));
      if (direction === 'left') {
        const minX = Math.min(...selected.map((n) => n.position.x));
        return {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.map((n) =>
            selectedIds.has(n.id) ? { ...n, position: { ...n.position, x: minX } } : n,
          ),
        };
      } else if (direction === 'top') {
        const minY = Math.min(...selected.map((n) => n.position.y));
        return {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.map((n) =>
            selectedIds.has(n.id) ? { ...n, position: { ...n.position, y: minY } } : n,
          ),
        };
      } else {
        // Distribute horizontally
        const sorted = [...selected].sort((a, b) => a.position.x - b.position.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (!first || !last) return prev;
        const minX = first.position.x;
        const maxX = last.position.x;
        const step = (maxX - minX) / (sorted.length - 1 || 1);
        const posMap = new Map<NodeId, number>();
        sorted.forEach((node, i) => posMap.set(node.id, Math.round(minX + i * step)));
        return {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.map((n) => {
            const mappedX = posMap.get(n.id);
            if (selectedIds.has(n.id) && mappedX !== undefined) {
              return { ...n, position: { ...n.position, x: mappedX } };
            }
            return n;
          }),
        };
      }
    });
  }, []);

  const addStroke = useCallback((stroke: CanvasStroke) => {
    setBoard((prev) => ({
      ...prev,
      isDirty: true,
      strokes: [...(prev.strokes ?? []), stroke],
    }));
  }, []);

  const undoStroke = useCallback(() => {
    setBoard((prev) => {
      const current = prev.strokes ?? [];
      if (current.length === 0) return prev;
      return {
        ...prev,
        isDirty: true,
        strokes: current.slice(0, -1),
      };
    });
  }, []);

  const clearStrokes = useCallback(() => {
    setBoard((prev) => ({
      ...prev,
      isDirty: true,
      strokes: [],
    }));
  }, []);

  const deleteStroke = useCallback((strokeId: string) => {
    setBoard((prev) => ({
      ...prev,
      isDirty: true,
      strokes: (prev.strokes ?? []).filter((s) => s.id !== strokeId),
    }));
  }, []);

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
          selectedNodeIds: [],
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
        const nextControlPoints = Object.fromEntries(
          Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => k !== edgeId),
        );
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: prev.edges.filter((e) => e.id !== edgeId),
          edgeControlPoints: nextControlPoints,
          selectedEdgeId: prev.selectedEdgeId === edgeId ? null : prev.selectedEdgeId,
        };
        triggerValidation(next);
        return next;
      });
    },
    [triggerValidation],
  );

  const updateEdgeControlPoint = useCallback((edgeId: EdgeId, point: CanvasPosition | null) => {
    setBoard((prev) => {
      const remaining = Object.fromEntries(
        Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => k !== edgeId),
      );
      const nextControlPoints = point === null ? remaining : { ...remaining, [edgeId]: point };
      return {
        ...prev,
        isDirty: true,
        edgeControlPoints: nextControlPoints,
      };
    });
  }, []);

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
    moveSelectedNodes,
    selectNode,
    selectNodes,
    selectEdge,
    setEntryNode,
    updateNode,
    updateEdgePolicy,
    addNode,
    duplicateNode,
    duplicateSelected,
    removeNode,
    deleteSelected,
    alignSelected,
    addEdge,
    removeEdge,
    updateEdgeControlPoint,
    addStroke,
    undoStroke,
    clearStrokes,
    deleteStroke,
  };
}
