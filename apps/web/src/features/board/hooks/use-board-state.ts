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
  type EdgePortSide,
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

export interface CanvasOperationPayload {
  readonly opId: string;
  readonly op:
    | 'create_node'
    | 'delete_node'
    | 'move_node'
    | 'update_node'
    | 'create_edge'
    | 'delete_edge'
    | 'update_edge'
    | 'move_edge_control_point';
  readonly payload: unknown;
}

export interface UseBoardStateOptions {
  readonly onLocalOperation?: ((op: CanvasOperationPayload) => void) | undefined;
}

export function useBoardState(
  initialTopology: Topology | null,
  api: ApiClient,
  options?: UseBoardStateOptions,
) {
  const isRemoteApplyingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const seenRemoteOpIdsRef = useRef<Set<string>>(new Set());
  const moveThrottleRef = useRef<
    Map<string, { lastSentTime: number; timer: ReturnType<typeof setTimeout> | null }>
  >(new Map());

  const emitLocalOp = useCallback((op: CanvasOperationPayload['op'], payload: unknown) => {
    if (isRemoteApplyingRef.current) return;
    const opId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    seenRemoteOpIdsRef.current.add(opId);
    if (seenRemoteOpIdsRef.current.size > 2000) {
      const first = seenRemoteOpIdsRef.current.values().next().value;
      if (first) seenRemoteOpIdsRef.current.delete(first);
    }
    optionsRef.current?.onLocalOperation?.({ opId, op, payload });
  }, []);

  const emitThrottledNodeMove = useCallback(
    (nodeId: NodeId, x: number, y: number) => {
      if (isRemoteApplyingRef.current) return;
      const now = performance.now();
      let entry = moveThrottleRef.current.get(nodeId);
      if (!entry) {
        entry = { lastSentTime: 0, timer: null };
        moveThrottleRef.current.set(nodeId, entry);
      }

      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }

      const elapsed = now - entry.lastSentTime;
      if (elapsed >= 50) {
        entry.lastSentTime = now;
        emitLocalOp('move_node', { nodeId, x, y });
      } else {
        entry.timer = setTimeout(() => {
          if (entry) {
            entry.lastSentTime = performance.now();
            entry.timer = null;
          }
          emitLocalOp('move_node', { nodeId, x, y });
        }, 50 - elapsed);
      }
    },
    [emitLocalOp],
  );

  useEffect(() => {
    return () => {
      moveThrottleRef.current.forEach((entry) => {
        if (entry.timer) clearTimeout(entry.timer);
      });
      moveThrottleRef.current.clear();
    };
  }, []);

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
      edgeControlPoints: {},
      edgeSourcePorts: {},
      edgeTargetPorts: {},
      strokes: [],
      validationProblems: [],
      isValidating: false,
      isDirty: false,
    };
  });

  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Excalidraw-Grade Board History (Undo / Redo for all canvas architecture actions)
  interface HistorySnapshot {
    readonly nodes: readonly BoardNode[];
    readonly edges: readonly TopologyEdge[];
    readonly edgeSourcePorts?: Readonly<Record<string, EdgePortSide>> | undefined;
    readonly edgeTargetPorts?: Readonly<Record<string, EdgePortSide>> | undefined;
    readonly edgeControlPoints?: Readonly<Record<string, CanvasPosition>> | undefined;
    readonly strokes?: readonly CanvasStroke[] | undefined;
    readonly entryNodeId: NodeId;
    readonly selectedNodeId: NodeId | null;
    readonly selectedNodeIds?: readonly NodeId[] | undefined;
    readonly selectedEdgeId: EdgeId | null;
  }

  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);

  const createSnapshot = (s: BoardState): HistorySnapshot => ({
    nodes: s.nodes,
    edges: s.edges,
    edgeSourcePorts: s.edgeSourcePorts,
    edgeTargetPorts: s.edgeTargetPorts,
    edgeControlPoints: s.edgeControlPoints,
    strokes: s.strokes,
    entryNodeId: s.entryNodeId,
    selectedNodeId: s.selectedNodeId,
    selectedNodeIds: s.selectedNodeIds,
    selectedEdgeId: s.selectedEdgeId,
  });

  const pushHistory = useCallback((prevBoard: BoardState) => {
    pastRef.current = [...pastRef.current.slice(-50), createSnapshot(prevBoard)];
    futureRef.current = [];
  }, []);

  const recordActionBeforeChange = useCallback(() => {
    setBoard((current) => {
      pushHistory(current);
      return current;
    });
  }, [pushHistory]);

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

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setBoard((current) => {
      const prevSnapshot = pastRef.current[pastRef.current.length - 1];
      if (!prevSnapshot) return current;
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current.slice(-50), createSnapshot(current)];

      const nextBoard: BoardState = {
        ...current,
        isDirty: true,
        nodes: [...prevSnapshot.nodes],
        edges: [...prevSnapshot.edges],
        edgeSourcePorts: prevSnapshot.edgeSourcePorts ? { ...prevSnapshot.edgeSourcePorts } : {},
        edgeTargetPorts: prevSnapshot.edgeTargetPorts ? { ...prevSnapshot.edgeTargetPorts } : {},
        edgeControlPoints: prevSnapshot.edgeControlPoints
          ? { ...prevSnapshot.edgeControlPoints }
          : {},
        strokes: prevSnapshot.strokes ? [...prevSnapshot.strokes] : [],
        entryNodeId: prevSnapshot.entryNodeId,
        selectedNodeId: prevSnapshot.selectedNodeId,
        selectedNodeIds: prevSnapshot.selectedNodeIds ? [...prevSnapshot.selectedNodeIds] : [],
        selectedEdgeId: prevSnapshot.selectedEdgeId,
      };
      triggerValidation(nextBoard);
      return nextBoard;
    });
  }, [triggerValidation]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setBoard((current) => {
      const nextSnapshot = futureRef.current[futureRef.current.length - 1];
      if (!nextSnapshot) return current;
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current.slice(-50), createSnapshot(current)];

      const nextBoard: BoardState = {
        ...current,
        isDirty: true,
        nodes: [...nextSnapshot.nodes],
        edges: [...nextSnapshot.edges],
        edgeSourcePorts: nextSnapshot.edgeSourcePorts ? { ...nextSnapshot.edgeSourcePorts } : {},
        edgeTargetPorts: nextSnapshot.edgeTargetPorts ? { ...nextSnapshot.edgeTargetPorts } : {},
        edgeControlPoints: nextSnapshot.edgeControlPoints
          ? { ...nextSnapshot.edgeControlPoints }
          : {},
        strokes: nextSnapshot.strokes ? [...nextSnapshot.strokes] : [],
        entryNodeId: nextSnapshot.entryNodeId,
        selectedNodeId: nextSnapshot.selectedNodeId,
        selectedNodeIds: nextSnapshot.selectedNodeIds ? [...nextSnapshot.selectedNodeIds] : [],
        selectedEdgeId: nextSnapshot.selectedEdgeId,
      };
      triggerValidation(nextBoard);
      return nextBoard;
    });
  }, [triggerValidation]);

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

  const updateNodePosition = useCallback(
    (nodeId: NodeId, x: number, y: number) => {
      setBoard((prev) => ({
        ...prev,
        isDirty: true,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)),
      }));
      emitThrottledNodeMove(nodeId, x, y);
    },
    [emitThrottledNodeMove],
  );

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
        pushHistory(prev);
        const next: BoardState = {
          ...prev,
          entryNodeId: nodeId,
          isDirty: true,
        };
        triggerValidation(next);
        return next;
      });
    },
    [pushHistory, triggerValidation],
  );

  const updateNode = useCallback(
    (nodeId: NodeId, patch: Partial<TopologyNode>, metaPatch?: Partial<NodeMeta>) => {
      setBoard((prev) => {
        pushHistory(prev);
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
        emitLocalOp('update_node', { nodeId, patch, metaPatch });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const updateEdgePolicy = useCallback(
    (edgeId: EdgeId, policy: EdgePolicy) => {
      setBoard((prev) => {
        pushHistory(prev);
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, policy } : e)),
        };
        triggerValidation(next);
        emitLocalOp('update_edge', { edgeId, policy });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const addNode = useCallback(
    (kind: NodeKind = 'service', preset?: NodePresetConfig) => {
      setBoard((prev) => {
        pushHistory(prev);
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
        emitLocalOp('create_node', { node: newNode });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const removeNode = useCallback(
    (nodeId: NodeId) => {
      setBoard((prev) => {
        if (prev.nodes.length <= 1) return prev; // Cannot delete last node
        pushHistory(prev);
        const remainingEdges = prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        const validEdgeIds = new Set(remainingEdges.map((e) => e.id));
        const nextControlPoints = Object.fromEntries(
          Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) =>
            validEdgeIds.has(k as EdgeId),
          ),
        );
        const nextSourcePorts = Object.fromEntries(
          Object.entries(prev.edgeSourcePorts ?? {}).filter(([k]) => validEdgeIds.has(k as EdgeId)),
        );
        const nextTargetPorts = Object.fromEntries(
          Object.entries(prev.edgeTargetPorts ?? {}).filter(([k]) => validEdgeIds.has(k as EdgeId)),
        );
        const next: BoardState = {
          ...prev,
          isDirty: true,
          nodes: prev.nodes.filter((n) => n.id !== nodeId),
          edges: remainingEdges,
          edgeControlPoints: nextControlPoints,
          edgeSourcePorts: nextSourcePorts,
          edgeTargetPorts: nextTargetPorts,
          selectedNodeId: prev.selectedNodeId === nodeId ? null : prev.selectedNodeId,
          selectedNodeIds: (prev.selectedNodeIds ?? []).filter((id) => id !== nodeId),
        };
        triggerValidation(next);
        emitLocalOp('delete_node', { nodeId });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const duplicateNode = useCallback(
    (nodeId: NodeId) => {
      setBoard((prev) => {
        const target = prev.nodes.find((n) => n.id === nodeId);
        if (!target) return prev;
        pushHistory(prev);
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
        emitLocalOp('create_node', { node: clonedNode });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const duplicateSelected = useCallback(() => {
    setBoard((prev) => {
      const selectedIds =
        prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []);
      if (selectedIds.length === 0) return prev;
      pushHistory(prev);

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

      // Replicate internal edges between the duplicated nodes along with their source/target ports and control points
      const newEdges: TopologyEdge[] = [];
      const newSourcePorts: Record<string, EdgePortSide> = {};
      const newTargetPorts: Record<string, EdgePortSide> = {};
      const newControlPoints: Record<string, CanvasPosition> = {};

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

          const sPort = prev.edgeSourcePorts?.[edge.id];
          if (sPort) {
            newSourcePorts[newEdgeId] = sPort;
          }
          const tPort = prev.edgeTargetPorts?.[edge.id];
          if (tPort) {
            newTargetPorts[newEdgeId] = tPort;
          }
          const cp = prev.edgeControlPoints?.[edge.id];
          if (cp) {
            newControlPoints[newEdgeId] = {
              x: cp.x + 40,
              y: cp.y + 40,
            };
          }
        }
      }

      const nextSelected = Array.from(idMap.values());
      const next: BoardState = {
        ...prev,
        isDirty: true,
        nodes: [...prev.nodes, ...newNodes],
        edges: [...prev.edges, ...newEdges],
        edgeSourcePorts: { ...(prev.edgeSourcePorts ?? {}), ...newSourcePorts },
        edgeTargetPorts: { ...(prev.edgeTargetPorts ?? {}), ...newTargetPorts },
        edgeControlPoints: { ...(prev.edgeControlPoints ?? {}), ...newControlPoints },
        selectedNodeIds: nextSelected,
        selectedNodeId: nextSelected[0] ?? null,
        selectedEdgeId: null,
      };
      triggerValidation(next);
      return next;
    });
  }, [pushHistory, triggerValidation]);

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
      pushHistory(prev);

      const remainingNodes = prev.nodes.filter((n) => !selectedIds.has(n.id));
      const remainingEdges = prev.edges.filter(
        (e) => !selectedIds.has(e.source) && !selectedIds.has(e.target) && e.id !== edgeIdToDelete,
      );
      const validEdgeIds = new Set(remainingEdges.map((e) => e.id));
      const nextControlPoints = Object.fromEntries(
        Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => validEdgeIds.has(k as EdgeId)),
      );
      const nextSourcePorts = Object.fromEntries(
        Object.entries(prev.edgeSourcePorts ?? {}).filter(([k]) => validEdgeIds.has(k as EdgeId)),
      );
      const nextTargetPorts = Object.fromEntries(
        Object.entries(prev.edgeTargetPorts ?? {}).filter(([k]) => validEdgeIds.has(k as EdgeId)),
      );

      const next: BoardState = {
        ...prev,
        isDirty: true,
        nodes: remainingNodes,
        edges: remainingEdges,
        edgeControlPoints: nextControlPoints,
        edgeSourcePorts: nextSourcePorts,
        edgeTargetPorts: nextTargetPorts,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
      triggerValidation(next);
      return next;
    });
  }, [pushHistory, triggerValidation]);

  const alignSelected = useCallback(
    (direction: 'left' | 'top' | 'distribute') => {
      setBoard((prev) => {
        const selectedIds = new Set(
          prev.selectedNodeIds ?? (prev.selectedNodeId ? [prev.selectedNodeId] : []),
        );
        if (selectedIds.size < 2) return prev;
        pushHistory(prev);

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
    },
    [pushHistory],
  );

  const addStroke = useCallback(
    (stroke: CanvasStroke) => {
      setBoard((prev) => {
        pushHistory(prev);
        return {
          ...prev,
          isDirty: true,
          strokes: [...(prev.strokes ?? []), stroke],
        };
      });
    },
    [pushHistory],
  );

  const undoStroke = useCallback(() => {
    setBoard((prev) => {
      const current = prev.strokes ?? [];
      if (current.length === 0) return prev;
      pushHistory(prev);
      return {
        ...prev,
        isDirty: true,
        strokes: current.slice(0, -1),
      };
    });
  }, [pushHistory]);

  const clearStrokes = useCallback(() => {
    setBoard((prev) => {
      pushHistory(prev);
      return {
        ...prev,
        isDirty: true,
        strokes: [],
      };
    });
  }, [pushHistory]);

  const deleteStroke = useCallback(
    (strokeId: string) => {
      setBoard((prev) => {
        pushHistory(prev);
        return {
          ...prev,
          isDirty: true,
          strokes: (prev.strokes ?? []).filter((s) => s.id !== strokeId),
        };
      });
    },
    [pushHistory],
  );

  const addEdge = useCallback(
    (source: NodeId, target: NodeId, sourcePort?: EdgePortSide, targetPort?: EdgePortSide) => {
      setBoard((prev) => {
        const id = edgeIdSchema.parse(`${source}-to-${target}`);
        if (prev.edges.some((e) => e.id === id || (e.source === source && e.target === target))) {
          // If edge already exists but user targeted specific ports, update cleanly
          let updatedSourcePorts = prev.edgeSourcePorts;
          let updatedTargetPorts = prev.edgeTargetPorts;
          let changed = false;
          if (sourcePort && prev.edgeSourcePorts?.[id] !== sourcePort) {
            updatedSourcePorts = { ...(prev.edgeSourcePorts ?? {}), [id]: sourcePort };
            changed = true;
          }
          if (targetPort && prev.edgeTargetPorts?.[id] !== targetPort) {
            updatedTargetPorts = { ...(prev.edgeTargetPorts ?? {}), [id]: targetPort };
            changed = true;
          }
          if (changed) {
            pushHistory(prev);
            return {
              ...prev,
              edgeSourcePorts: updatedSourcePorts,
              edgeTargetPorts: updatedTargetPorts,
            };
          }
          return prev;
        }
        pushHistory(prev);
        const newEdge: TopologyEdge = {
          id,
          source,
          target,
          mode: 'sync_call',
          policy: defaultEdgePolicy,
        };
        const nextSourcePorts = sourcePort
          ? { ...(prev.edgeSourcePorts ?? {}), [id]: sourcePort }
          : prev.edgeSourcePorts;
        const nextTargetPorts = targetPort
          ? { ...(prev.edgeTargetPorts ?? {}), [id]: targetPort }
          : prev.edgeTargetPorts;
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: [...prev.edges, newEdge],
          edgeSourcePorts: nextSourcePorts,
          edgeTargetPorts: nextTargetPorts,
          selectedEdgeId: id,
          selectedNodeId: null,
          selectedNodeIds: [],
        };
        triggerValidation(next);
        emitLocalOp('create_edge', { edge: newEdge });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const reconnectEdge = useCallback(
    (
      edgeId: EdgeId,
      newSource: NodeId,
      newTarget: NodeId,
      newSourceSide?: EdgePortSide,
      newTargetSide?: EdgePortSide,
    ) => {
      setBoard((prev) => {
        const existing = prev.edges.find((e) => e.id === edgeId);
        if (!existing) return prev;
        if (newSource === newTarget) return prev; // Avoid self-loop on reconnection

        const newId = edgeIdSchema.parse(`${newSource}-to-${newTarget}`);
        const edgesWithoutOld = prev.edges.filter((e) => e.id !== edgeId);

        // Check if an edge between these two nodes already exists (different from the one being reconnected)
        if (
          newId !== edgeId &&
          edgesWithoutOld.some((e) => e.source === newSource && e.target === newTarget)
        ) {
          return prev;
        }

        pushHistory(prev);

        const updatedEdge: TopologyEdge = {
          ...existing,
          id: newId,
          source: newSource,
          target: newTarget,
        };

        const nextControlPoints = Object.fromEntries(
          Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => k !== edgeId),
        );

        const nextSourcePorts = { ...(prev.edgeSourcePorts ?? {}) };
        delete nextSourcePorts[edgeId];
        if (newSourceSide) {
          nextSourcePorts[newId] = newSourceSide;
        } else if (prev.edgeSourcePorts?.[edgeId]) {
          nextSourcePorts[newId] = prev.edgeSourcePorts[edgeId];
        }

        const nextTargetPorts = { ...(prev.edgeTargetPorts ?? {}) };
        delete nextTargetPorts[edgeId];
        if (newTargetSide) {
          nextTargetPorts[newId] = newTargetSide;
        } else if (prev.edgeTargetPorts?.[edgeId]) {
          nextTargetPorts[newId] = prev.edgeTargetPorts[edgeId];
        }

        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: [...edgesWithoutOld, updatedEdge],
          edgeControlPoints: nextControlPoints,
          edgeSourcePorts: nextSourcePorts,
          edgeTargetPorts: nextTargetPorts,
          selectedEdgeId: newId,
        };
        triggerValidation(next);
        return next;
      });
    },
    [pushHistory, triggerValidation],
  );

  const removeEdge = useCallback(
    (edgeId: EdgeId) => {
      setBoard((prev) => {
        pushHistory(prev);
        const nextControlPoints = Object.fromEntries(
          Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => k !== edgeId),
        );
        const nextSourcePorts = Object.fromEntries(
          Object.entries(prev.edgeSourcePorts ?? {}).filter(([k]) => k !== edgeId),
        );
        const nextTargetPorts = Object.fromEntries(
          Object.entries(prev.edgeTargetPorts ?? {}).filter(([k]) => k !== edgeId),
        );
        const next: BoardState = {
          ...prev,
          isDirty: true,
          edges: prev.edges.filter((e) => e.id !== edgeId),
          edgeControlPoints: nextControlPoints,
          edgeSourcePorts: nextSourcePorts,
          edgeTargetPorts: nextTargetPorts,
          selectedEdgeId: prev.selectedEdgeId === edgeId ? null : prev.selectedEdgeId,
        };
        triggerValidation(next);
        emitLocalOp('delete_edge', { edgeId });
        return next;
      });
    },
    [emitLocalOp, pushHistory, triggerValidation],
  );

  const updateEdgeControlPoint = useCallback(
    (edgeId: EdgeId, point: CanvasPosition | null) => {
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
      emitLocalOp('move_edge_control_point', { edgeId, point });
    },
    [emitLocalOp],
  );

  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Replaces the board's nodes and edges with a room snapshot. Used only to recover state whose
   * operation history is no longer available; ordinary collaboration replays operations.
   */
  const applyRemoteSnapshot = useCallback(
    (snapshot: unknown) => {
      if (!snapshot || typeof snapshot !== 'object') return;
      const { nodes, edges } = snapshot as { nodes?: unknown; edges?: unknown };
      if (!Array.isArray(nodes) || !Array.isArray(edges)) return;
      isRemoteApplyingRef.current = true;
      try {
        setBoard((prev) => {
          const next = {
            ...prev,
            nodes: nodes as typeof prev.nodes,
            edges: edges as typeof prev.edges,
            selectedNodeId: null,
            selectedNodeIds: [],
          };
          triggerValidation(next);
          return next;
        });
      } finally {
        isRemoteApplyingRef.current = false;
      }
    },
    [triggerValidation],
  );

  const applyRemoteCanvasOp = useCallback(
    (rawOp: unknown) => {
      if (!rawOp || typeof rawOp !== 'object') return;
      const opData = rawOp as {
        op: string;
        payload: any;
        opId?: string;
        operations?: any[];
      };

      if (Array.isArray(opData.operations)) {
        for (const singleOp of opData.operations) {
          applyRemoteCanvasOp(singleOp);
        }
        return;
      }

      if (opData.opId) {
        if (seenRemoteOpIdsRef.current.has(opData.opId)) return;
        seenRemoteOpIdsRef.current.add(opData.opId);
        if (seenRemoteOpIdsRef.current.size > 2000) {
          const first = seenRemoteOpIdsRef.current.values().next().value;
          if (first) seenRemoteOpIdsRef.current.delete(first);
        }
      }

      isRemoteApplyingRef.current = true;
      try {
        if (opData.op === 'create_node' && opData.payload?.node) {
          setBoard((prev) => {
            if (prev.nodes.some((n) => n.id === opData.payload.node.id)) return prev;
            const next = {
              ...prev,
              nodes: [...prev.nodes, opData.payload.node],
            };
            triggerValidation(next);
            return next;
          });
        } else if (opData.op === 'delete_node' && opData.payload?.nodeId) {
          setBoard((prev) => {
            const remainingEdges = prev.edges.filter(
              (e) => e.source !== opData.payload.nodeId && e.target !== opData.payload.nodeId,
            );
            const next = {
              ...prev,
              nodes: prev.nodes.filter((n) => n.id !== opData.payload.nodeId),
              edges: remainingEdges,
              selectedNodeId:
                prev.selectedNodeId === opData.payload.nodeId ? null : prev.selectedNodeId,
              selectedNodeIds: (prev.selectedNodeIds ?? []).filter(
                (id) => id !== opData.payload.nodeId,
              ),
            };
            triggerValidation(next);
            return next;
          });
        } else if (opData.op === 'move_node' && opData.payload?.nodeId) {
          setBoard((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === opData.payload.nodeId
                ? { ...n, position: { x: opData.payload.x, y: opData.payload.y } }
                : n,
            ),
          }));
        } else if (opData.op === 'update_node' && opData.payload?.nodeId && opData.payload?.patch) {
          setBoard((prev) => {
            const next = {
              ...prev,
              nodes: prev.nodes.map((n) =>
                n.id === opData.payload.nodeId ? { ...n, ...opData.payload.patch } : n,
              ),
            };
            triggerValidation(next);
            return next;
          });
        } else if (opData.op === 'create_edge' && opData.payload?.edge) {
          setBoard((prev) => {
            if (prev.edges.some((e) => e.id === opData.payload.edge.id)) return prev;
            const next = {
              ...prev,
              edges: [...prev.edges, opData.payload.edge],
            };
            triggerValidation(next);
            return next;
          });
        } else if (opData.op === 'delete_edge' && opData.payload?.edgeId) {
          setBoard((prev) => {
            const next = {
              ...prev,
              edges: prev.edges.filter((e) => e.id !== opData.payload.edgeId),
              selectedEdgeId:
                prev.selectedEdgeId === opData.payload.edgeId ? null : prev.selectedEdgeId,
            };
            triggerValidation(next);
            return next;
          });
        } else if (
          opData.op === 'update_edge' &&
          opData.payload?.edgeId &&
          opData.payload?.policy
        ) {
          setBoard((prev) => {
            const next = {
              ...prev,
              edges: prev.edges.map((e) =>
                e.id === opData.payload.edgeId ? { ...e, policy: opData.payload.policy } : e,
              ),
            };
            triggerValidation(next);
            return next;
          });
        } else if (opData.op === 'move_edge_control_point' && opData.payload?.edgeId) {
          setBoard((prev) => {
            const edgeId = opData.payload.edgeId;
            const point = opData.payload.point as CanvasPosition | null;
            const remaining = Object.fromEntries(
              Object.entries(prev.edgeControlPoints ?? {}).filter(([k]) => k !== edgeId),
            );
            return {
              ...prev,
              edgeControlPoints: point === null ? remaining : { ...remaining, [edgeId]: point },
            };
          });
        }
      } finally {
        isRemoteApplyingRef.current = false;
      }
    },
    [triggerValidation],
  );

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
    reconnectEdge,
    removeEdge,
    updateEdgeControlPoint,
    addStroke,
    undoStroke,
    clearStrokes,
    deleteStroke,
    undo,
    redo,
    recordActionBeforeChange,
    applyRemoteCanvasOp,
    applyRemoteSnapshot,
  };
}
