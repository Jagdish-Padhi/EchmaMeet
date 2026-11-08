import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { EdgeId, NodeId, NodeKind } from '@chaosboard/contracts';
import type { BoardNode, BoardState, CanvasPosition, CanvasStroke, DrawTool } from '../types';
import { EdgeLink } from './EdgeLink';
import { NodeCard, type NodePortPosition } from './NodeCard';
import { computeRubberbandRoute, type Point } from '../utils/edge-router';
import { FemaleArchitectIcon } from '../../../components/ui/FemaleArchitectIcon';

export interface RemoteCursor {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly cursor: { readonly x: number; readonly y: number };
}

export interface BoardCanvasProps {
  readonly board: BoardState;
  readonly activeTool?: DrawTool;
  readonly onSelectTool?: (tool: DrawTool) => void;
  readonly penColor?: string;
  readonly onSelectPenColor?: (color: string) => void;
  readonly penWidth?: number;
  readonly onSelectPenWidth?: (width: number) => void;
  readonly remoteCursors?: readonly RemoteCursor[];
  readonly onCursorMove?: (x: number, y: number) => void;
  readonly onSelectNode: (id: NodeId | null) => void;
  readonly onSelectNodes?: (ids: readonly NodeId[]) => void;
  readonly onSelectEdge: (id: EdgeId | null) => void;
  readonly onMoveNode: (id: NodeId, x: number, y: number) => void;
  readonly onMoveSelectedNodes?: (dx: number, dy: number) => void;
  readonly onAddNode: (kind?: NodeKind) => void;
  readonly onAddEdge: (
    source: NodeId,
    target: NodeId,
    sourcePort?: 'top' | 'right' | 'bottom' | 'left',
    targetPort?: 'top' | 'right' | 'bottom' | 'left',
  ) => void;
  readonly onReconnectEdge?: (
    edgeId: EdgeId,
    newSource: NodeId,
    newTarget: NodeId,
    newSourceSide?: 'top' | 'right' | 'bottom' | 'left',
    newTargetSide?: 'top' | 'right' | 'bottom' | 'left',
  ) => void;
  readonly onDuplicateNode?: (id: NodeId) => void;
  readonly onDuplicateSelected?: () => void;
  readonly onDeleteNode?: (id: NodeId) => void;
  readonly onDeleteSelected?: () => void;
  readonly onDeleteEdge?: (id: EdgeId) => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly onRecordHistory?: () => void;
  readonly onAddStroke?: (stroke: CanvasStroke) => void;
  readonly onUndoStroke?: () => void;
  readonly onClearStrokes?: () => void;
  readonly onDeleteStroke?: (id: string) => void;
  readonly onUpdateEdgeControlPoint?: (edgeId: EdgeId, point: CanvasPosition | null) => void;
  readonly hazardEdgeId?: EdgeId | null;
  readonly hazardNodeId?: NodeId | null;
  readonly echmaSpeakingRequest?:
    | {
        readonly isRequested: boolean;
        readonly hostName: string;
        readonly onAllow: () => void;
        readonly onDismiss: () => void;
        readonly onAutoRemediate?: (() => void) | undefined;
      }
    | undefined;
  readonly hazardBanner?:
    | {
        readonly hazardCount: number;
        readonly onReviewFinding: () => void;
        readonly onAutoRemediate?: (() => void) | undefined;
        readonly onDismiss?: (() => void) | undefined;
      }
    | undefined;
}

function pointsToSmoothPath(points: readonly CanvasPosition[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) {
    return `M ${String(first.x)} ${String(first.y)} L ${String(first.x + 0.5)} ${String(first.y + 0.5)}`;
  }
  const second = points[1];
  if (points.length === 2 && second) {
    return `M ${String(first.x)} ${String(first.y)} L ${String(second.x)} ${String(second.y)}`;
  }

  let d = `M ${String(first.x)} ${String(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1 && p2) {
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      d += ` Q ${String(p1.x)} ${String(p1.y)}, ${String(xc)} ${String(yc)}`;
    }
  }
  const last = points[points.length - 1];
  if (last) {
    d += ` L ${String(last.x)} ${String(last.y)}`;
  }
  return d;
}

function distToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function isPointNearStroke(
  point: CanvasPosition,
  stroke: CanvasStroke,
  threshold: number,
): boolean {
  const thresholdSq = threshold * threshold;
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1 && pts[0]) {
    const dx = point.x - pts[0].x;
    const dy = point.y - pts[0].y;
    return dx * dx + dy * dy <= thresholdSq;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (p1 && p2) {
      if (distToSegmentSquared(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= thresholdSq) {
        return true;
      }
    }
  }
  return false;
}

export function BoardCanvas({
  board,
  activeTool: propActiveTool,
  onSelectTool,
  penColor: propPenColor,
  onSelectPenColor,
  penWidth: propPenWidth,
  onSelectPenWidth,
  remoteCursors = [],
  onCursorMove,
  onSelectNode,
  onSelectNodes,
  onSelectEdge,
  onMoveNode,
  onMoveSelectedNodes,
  onAddNode,
  onAddEdge,
  onReconnectEdge,
  onDuplicateNode,
  onDuplicateSelected,
  onDeleteNode,
  onDeleteSelected,
  onDeleteEdge,
  onUndo,
  onRedo,
  onRecordHistory,
  onAddStroke,
  onUndoStroke,
  onClearStrokes,
  onDeleteStroke,
  onUpdateEdgeControlPoint,
  hazardEdgeId,
  hazardNodeId,
  echmaSpeakingRequest,
  hazardBanner,
}: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan & Zoom State (Excalidraw / Breakscale grade)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const [isPanningState, setIsPanningState] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastCanvasClickTimeRef = useRef<number>(0);
  const lastCanvasClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isErasingRef = useRef(false);
  const draggingEdgeControlRef = useRef<{
    edgeId: EdgeId;
    isVertical: boolean;
    segmentIndex: number;
    initialHandle: Point;
  } | null>(null);
  const hasRecordedDragRef = useRef<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Active Tool Mode (Controlled via Props or Internal Fallback)
  const [internalTool, setInternalTool] = useState<DrawTool>('select');
  const activeTool = propActiveTool ?? internalTool;
  const setActiveTool = useCallback(
    (tool: DrawTool) => {
      setInternalTool(tool);
      onSelectTool?.(tool);
    },
    [onSelectTool],
  );

  const [internalPenColor, setInternalPenColor] = useState<string>('#38bdf8');
  const penColor = propPenColor ?? internalPenColor;
  const setPenColor = useCallback(
    (color: string) => {
      setInternalPenColor(color);
      onSelectPenColor?.(color);
    },
    [onSelectPenColor],
  );

  const [internalPenWidth, setInternalPenWidth] = useState<number>(3);
  const penWidth = propPenWidth ?? internalPenWidth;
  const setPenWidth = useCallback(
    (width: number) => {
      setInternalPenWidth(width);
      onSelectPenWidth?.(width);
    },
    [onSelectPenWidth],
  );

  const eraseStrokesAt = useCallback(
    (coords: CanvasPosition) => {
      if (!onDeleteStroke || !board.strokes || board.strokes.length === 0) return;
      const threshold = Math.max(16, 20 / zoom);
      for (const stroke of board.strokes) {
        if (isPointNearStroke(coords, stroke, threshold)) {
          onDeleteStroke(stroke.id);
        }
      }
    },
    [board.strokes, onDeleteStroke, zoom],
  );

  // Freehand Drawing Live State
  const [currentStroke, setCurrentStroke] = useState<readonly CanvasPosition[] | null>(null);

  // Marquee Crop / Box Selection State
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Wire Connection Dragging & Reconnecting State
  const [connectingSource, setConnectingSource] = useState<NodeId | null>(null);
  const [connectingTarget, setConnectingTarget] = useState<NodeId | null>(null);
  const [reconnectingEdgeId, setReconnectingEdgeId] = useState<EdgeId | null>(null);
  const [reconnectingSide, setReconnectingSide] = useState<'source' | 'target'>('target');
  const [connectingPort, setConnectingPort] = useState<'top' | 'right' | 'bottom' | 'left'>(
    'right',
  );
  const [connectingCursor, setConnectingCursor] = useState<{ x: number; y: number } | null>(null);
  const connectStartPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hasMovedWireRef = useRef(false);

  // Rock-Solid Absolute Delta Node Dragging State (Single & Multi-Node Group)
  const draggingNodeRef = useRef<{
    id: NodeId;
    isGroup: boolean;
    startClientX: number;
    startClientY: number;
    initialPositions: Map<NodeId, { x: number; y: number }>;
  } | null>(null);

  const selectedNodeSet = new Set(
    board.selectedNodeIds && board.selectedNodeIds.length > 0
      ? board.selectedNodeIds
      : board.selectedNodeId
        ? [board.selectedNodeId]
        : [],
  );

  // Keyboard Shortcuts:
  // V (select), M (marquee), P (pen), H (highlighter), E (eraser), Space (pan)
  // Ctrl+D (duplicate), Del/Backspace (delete), 1-4 (quick add), Esc (deselect), Ctrl+Z (undo stroke)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Space to Pan
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      // Tool Switching Shortcuts
      if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'm') {
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'p') {
        setActiveTool('pen');
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool('eraser');
      }

      // Ctrl+Z or Cmd+Z for Canvas Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (onUndo) {
          e.preventDefault();
          onUndo();
        } else if (onUndoStroke) {
          e.preventDefault();
          onUndoStroke();
        }
      }

      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for Canvas Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        if (onRedo) {
          e.preventDefault();
          onRedo();
        }
      }

      // Ctrl+D or Cmd+D to Duplicate Selected Node or Group (including connecting arrows)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNodeSet.size >= 1 && onDuplicateSelected) {
          onDuplicateSelected();
        } else if (board.selectedNodeId && onDuplicateNode) {
          onDuplicateNode(board.selectedNodeId);
        }
      }

      // Delete or Backspace to Remove Selected Element(s)
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (selectedNodeSet.size > 1 && onDeleteSelected) {
          onDeleteSelected();
        } else if (board.selectedNodeId && onDeleteNode) {
          onDeleteNode(board.selectedNodeId);
        } else if (board.selectedEdgeId && onDeleteEdge) {
          onDeleteEdge(board.selectedEdgeId);
        }
      }

      // Quick-add shortcuts (1=Service, 2=Cache, 3=Queue, 4=Sink)
      if (e.key === '1') {
        onAddNode('service');
      } else if (e.key === '2') {
        onAddNode('cache');
      } else if (e.key === '3') {
        onAddNode('queue_consumer');
      } else if (e.key === '4') {
        onAddNode('ledger_sink');
      }

      // Escape to Deselect / Cancel Active Wire / Reset tool
      if (e.key === 'Escape') {
        onSelectNode(null);
        onSelectNodes?.([]);
        onSelectEdge(null);
        setConnectingSource(null);
        setConnectingCursor(null);
        setCurrentStroke(null);
        setMarqueeBox(null);
        setActiveTool('select');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    board.selectedNodeId,
    board.selectedEdgeId,
    isSpacePressed,
    onAddNode,
    onDuplicateNode,
    onDuplicateSelected,
    onDeleteNode,
    onDeleteSelected,
    onDeleteEdge,
    onUndo,
    onRedo,
    onSelectNode,
    onSelectNodes,
    onSelectEdge,
    onUndoStroke,
    selectedNodeSet.size,
    setActiveTool,
  ]);

  // Convert screen coordinates to canvas space (accounting for pan & zoom)
  const screenToCanvasCoords = useCallback(
    (clientX: number, clientY: number): CanvasPosition => {
      if (!svgRef.current) return { x: clientX, y: clientY };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  // Node Drag Start (Single or Group)
  const handleDragStart = (id: NodeId, e: ReactMouseEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    // If clicking an unselected node in select mode, select it first
    const isAlreadySelected = selectedNodeSet.has(id);
    if (!isAlreadySelected) {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        onSelectNode(id);
      } else {
        onSelectNodes?.([...Array.from(selectedNodeSet), id]);
      }
    }

    const clickedNode = board.nodes.find((n) => n.id === id);
    if (!clickedNode) return;

    const isGroupDrag = isAlreadySelected && selectedNodeSet.size > 1;
    const initialPositions = new Map<NodeId, { x: number; y: number }>();

    if (isGroupDrag) {
      for (const n of board.nodes) {
        if (selectedNodeSet.has(n.id)) {
          initialPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      }
    } else {
      initialPositions.set(id, { x: clickedNode.position.x, y: clickedNode.position.y });
    }

    draggingNodeRef.current = {
      id,
      isGroup: isGroupDrag,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPositions,
    };
  };

  // Start wire dragging from output handle
  const handleStartConnect = (
    sourceId: NodeId,
    e: ReactMouseEvent<SVGElement>,
    port: 'top' | 'right' | 'bottom' | 'left' = 'right',
  ) => {
    e.stopPropagation();
    setConnectingSource(sourceId);
    setConnectingTarget(null);
    setReconnectingEdgeId(null);
    setConnectingPort(port);
    setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
    connectStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasMovedWireRef.current = false;
  };

  // Start reconnecting / detaching an existing edge source dot
  const handleStartReconnectSource = (edgeId: EdgeId, targetId: NodeId, e: ReactMouseEvent) => {
    e.stopPropagation();
    setConnectingSource(null);
    setConnectingTarget(targetId);
    setReconnectingEdgeId(edgeId);
    setReconnectingSide('source');
    setConnectingPort('left');
    setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
    connectStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasMovedWireRef.current = true;
  };

  // Start reconnecting / detaching an existing edge arrowhead
  const handleStartReconnectTarget = (edgeId: EdgeId, sourceId: NodeId, e: ReactMouseEvent) => {
    e.stopPropagation();
    setConnectingSource(sourceId);
    setConnectingTarget(null);
    setReconnectingEdgeId(edgeId);
    setReconnectingSide('target');
    setConnectingPort('right');
    setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
    connectStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasMovedWireRef.current = true;
  };

  // Drop wire on target node
  const handleDropConnect = (targetId: NodeId, targetPort?: NodePortPosition) => {
    if (reconnectingEdgeId && onReconnectEdge) {
      if (reconnectingSide === 'source' && connectingTarget && connectingTarget !== targetId) {
        onReconnectEdge(reconnectingEdgeId, targetId, connectingTarget, targetPort, undefined);
      } else if (
        reconnectingSide === 'target' &&
        connectingSource &&
        connectingSource !== targetId
      ) {
        onReconnectEdge(reconnectingEdgeId, connectingSource, targetId, undefined, targetPort);
      }
    } else if (connectingSource && connectingSource !== targetId) {
      onAddEdge(connectingSource, targetId, connectingPort, targetPort);
    }
    setConnectingSource(null);
    setConnectingTarget(null);
    setReconnectingEdgeId(null);
    setConnectingCursor(null);
    connectStartPosRef.current = null;
    hasMovedWireRef.current = false;
  };

  // Start dragging edge control point handle (Excalidraw-grade arrow sliding & curving)
  const handleEdgeControlPointDragStart = useCallback(
    (
      edgeId: EdgeId,
      e: ReactMouseEvent,
      isVertical: boolean,
      segmentIndex: number,
      handlePoint: Point,
    ) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onSelectEdge(edgeId);
      draggingEdgeControlRef.current = {
        edgeId,
        isVertical,
        segmentIndex,
        initialHandle: handlePoint,
      };
    },
    [onSelectEdge],
  );

  // Canvas Mouse Down: Starts Pan, Marquee Crop Select, or Freehand Pen Stroke
  const handleCanvasMouseDown = (e: ReactMouseEvent<SVGSVGElement>) => {
    // 1. Pan with Middle Click or Space Key
    if (e.button === 1 || isSpacePressed) {
      isPanningRef.current = true;
      setIsPanningState(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return; // Only process left click

    const coords = screenToCanvasCoords(e.clientX, e.clientY);

    // 2. Freehand Pen or Highlighter Tool
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentStroke([coords]);
      return;
    }

    // 2b. Eraser Tool: Immediate erase & enable dragging erase
    if (activeTool === 'eraser') {
      isErasingRef.current = true;
      eraseStrokesAt(coords);
      return;
    }

    // 3. Selection Mode / Free Space on Canvas (Marquee drag or Double-Click-Hold to Pan)
    if (
      activeTool === 'select' ||
      activeTool === 'marquee' ||
      e.target === svgRef.current ||
      (e.target as SVGElement).id === 'canvas-matrix-bg'
    ) {
      const now = Date.now();
      const timeSinceLastClick = now - lastCanvasClickTimeRef.current;
      const posDiff = Math.hypot(
        e.clientX - lastCanvasClickPosRef.current.x,
        e.clientY - lastCanvasClickPosRef.current.y,
      );

      // Excalidraw-style Double-Click & Hold to pan/move canvas in free space
      if (timeSinceLastClick < 400 && posDiff < 30) {
        isPanningRef.current = true;
        setIsPanningState(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        lastCanvasClickTimeRef.current = 0;
        e.preventDefault();
        return;
      }

      lastCanvasClickTimeRef.current = now;
      lastCanvasClickPosRef.current = { x: e.clientX, y: e.clientY };

      setMarqueeBox({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });

      // Clear existing selection if not shift-clicking
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        onSelectNode(null);
        onSelectNodes?.([]);
        onSelectEdge(null);
      }
      setConnectingSource(null);
      setConnectingCursor(null);
    }
  };

  // Canvas Mouse Move: Handles Panning, Live Drawing, Marquee Selection, Node Dragging, or Wire Dragging
  const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const coords = screenToCanvasCoords(e.clientX, e.clientY);

    // 0. Dragging Edge Bend / Control Point (Excalidraw-Grade Sliding & Curving)
    if (draggingEdgeControlRef.current) {
      if (!hasRecordedDragRef.current) {
        onRecordHistory?.();
        hasRecordedDragRef.current = true;
      }
      const { edgeId, isVertical } = draggingEdgeControlRef.current;
      const current = board.edgeControlPoints?.[edgeId];
      const updatedPoint: CanvasPosition = {
        x: isVertical ? Math.round(coords.x) : (current?.x ?? Math.round(coords.x)),
        y: !isVertical ? Math.round(coords.y) : (current?.y ?? Math.round(coords.y)),
      };
      onUpdateEdgeControlPoint?.(edgeId, updatedPoint);
      return;
    }

    // 1. Panning
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    // 2. Freehand Drawing Live Stroke
    if (currentStroke) {
      setCurrentStroke((prev) => (prev ? [...prev, coords] : [coords]));
      return;
    }

    // 2b. Eraser Live Drag Erasing
    if (activeTool === 'eraser' && isErasingRef.current) {
      eraseStrokesAt(coords);
      return;
    }

    // 3. Marquee Crop Box Dragging
    if (marqueeBox) {
      setMarqueeBox((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
      return;
    }

    // 4. Wire Connection Dragging
    if (connectingSource) {
      setConnectingCursor(coords);
      if (connectStartPosRef.current) {
        const dX = Math.abs(e.clientX - connectStartPosRef.current.clientX);
        const dY = Math.abs(e.clientY - connectStartPosRef.current.clientY);
        if (dX > 6 || dY > 6) {
          hasMovedWireRef.current = true;
        }
      }
      return;
    }

    // 5. Node or Group Dragging (Absolute delta, rock-solid 60fps)
    if (draggingNodeRef.current) {
      if (!hasRecordedDragRef.current) {
        onRecordHistory?.();
        hasRecordedDragRef.current = true;
      }
      const { id, isGroup, startClientX, startClientY, initialPositions } = draggingNodeRef.current;
      const dx = (e.clientX - startClientX) / zoom;
      const dy = (e.clientY - startClientY) / zoom;

      if (isGroup) {
        for (const [nodeId, initialPos] of initialPositions.entries()) {
          onMoveNode(nodeId, Math.round(initialPos.x + dx), Math.round(initialPos.y + dy));
        }
      } else {
        const initPos = initialPositions.get(id);
        if (initPos) {
          onMoveNode(id, Math.round(initPos.x + dx), Math.round(initPos.y + dy));
        }
      }
    }
  };

  // Global Window Listeners for Seamless Sticky Dragging & Drawing
  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      const coords = screenToCanvasCoords(e.clientX, e.clientY);

      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
        return;
      }

      if (draggingEdgeControlRef.current) {
        if (!hasRecordedDragRef.current) {
          onRecordHistory?.();
          hasRecordedDragRef.current = true;
        }
        const { edgeId, isVertical } = draggingEdgeControlRef.current;
        const current = board.edgeControlPoints?.[edgeId];
        const updatedPoint: CanvasPosition = {
          x: isVertical ? Math.round(coords.x) : (current?.x ?? Math.round(coords.x)),
          y: !isVertical ? Math.round(coords.y) : (current?.y ?? Math.round(coords.y)),
        };
        onUpdateEdgeControlPoint?.(edgeId, updatedPoint);
        return;
      }

      if (currentStroke) {
        setCurrentStroke((prev) => (prev ? [...prev, coords] : [coords]));
        return;
      }

      if (activeTool === 'eraser' && isErasingRef.current) {
        eraseStrokesAt(coords);
        return;
      }

      if (marqueeBox) {
        setMarqueeBox((prev) =>
          prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null,
        );
        return;
      }

      if (connectingSource) {
        setConnectingCursor(coords);
        if (connectStartPosRef.current) {
          const dX = Math.abs(e.clientX - connectStartPosRef.current.clientX);
          const dY = Math.abs(e.clientY - connectStartPosRef.current.clientY);
          if (dX > 6 || dY > 6) {
            hasMovedWireRef.current = true;
          }
        }
        return;
      }

      if (draggingNodeRef.current) {
        if (!hasRecordedDragRef.current) {
          onRecordHistory?.();
          hasRecordedDragRef.current = true;
        }
        const { id, isGroup, startClientX, startClientY, initialPositions } =
          draggingNodeRef.current;
        const dx = (e.clientX - startClientX) / zoom;
        const dy = (e.clientY - startClientY) / zoom;

        if (isGroup) {
          for (const [nodeId, initialPos] of initialPositions.entries()) {
            onMoveNode(nodeId, Math.round(initialPos.x + dx), Math.round(initialPos.y + dy));
          }
        } else {
          const initPos = initialPositions.get(id);
          if (initPos) {
            onMoveNode(id, Math.round(initPos.x + dx), Math.round(initPos.y + dy));
          }
        }
      }

      if (onCursorMove) {
        onCursorMove(coords.x, coords.y);
      }
    };

    const handleGlobalMouseUp = () => {
      isPanningRef.current = false;
      setIsPanningState(false);
      if (draggingNodeRef.current) {
        lastCanvasClickTimeRef.current = 0;
      }
      draggingNodeRef.current = null;
      isErasingRef.current = false;
      draggingEdgeControlRef.current = null;
      hasRecordedDragRef.current = false;

      // Finalize Freehand Drawing Stroke
      if (currentStroke && currentStroke.length > 1) {
        if (onAddStroke) {
          onAddStroke({
            id: `stroke-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
            color: penColor,
            width: activeTool === 'highlighter' ? penWidth * 3.5 : penWidth,
            points: currentStroke,
          });
        }
      }
      setCurrentStroke(null);

      // Finalize Marquee Selection Box
      if (marqueeBox) {
        const left = Math.min(marqueeBox.startX, marqueeBox.currentX);
        const top = Math.min(marqueeBox.startY, marqueeBox.currentY);
        const width = Math.abs(marqueeBox.currentX - marqueeBox.startX);
        const height = Math.abs(marqueeBox.currentY - marqueeBox.startY);

        if (width > 6 || height > 6) {
          lastCanvasClickTimeRef.current = 0;
          // Detect all enclosed / intersecting nodes (cards are 188x80)
          const enclosedIds = board.nodes
            .filter((node) => {
              const nodeRight = node.position.x + 188;
              const nodeBottom = node.position.y + 80;
              return (
                nodeRight >= left &&
                node.position.x <= left + width &&
                nodeBottom >= top &&
                node.position.y <= top + height
              );
            })
            .map((n) => n.id);

          if (enclosedIds.length > 0) {
            onSelectNodes?.(enclosedIds);
          }
        }
        setMarqueeBox(null);
      }

      // Cleanly cancel connection / reconnection if released in empty space (not dropped on a node port)
      if (connectingSource || connectingTarget || reconnectingEdgeId) {
        setConnectingSource(null);
        setConnectingTarget(null);
        setReconnectingEdgeId(null);
        setConnectingCursor(null);
        connectStartPosRef.current = null;
        hasMovedWireRef.current = false;
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    activeTool,
    board.edgeControlPoints,
    board.nodes,
    connectingSource,
    currentStroke,
    eraseStrokesAt,
    marqueeBox,
    onAddStroke,
    onCursorMove,
    onMoveNode,
    onMoveSelectedNodes,
    onRecordHistory,
    onSelectNodes,
    onUpdateEdgeControlPoint,
    penColor,
    penWidth,
    screenToCanvasCoords,
    zoom,
  ]);

  // Native non-passive Wheel Listener for Butter-Smooth Pan & Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      if (!svgRef.current) return;

      if (e.ctrlKey || e.metaKey) {
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = Math.exp(-e.deltaY * 0.0035);
        setZoom((prevZoom) => {
          const nextZoom = Math.min(3.0, Math.max(0.25, prevZoom * zoomFactor));
          setPan((prevPan) => ({
            x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
            y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom),
          }));
          return nextZoom;
        });
      } else {
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const nodeMap = new Map<NodeId, BoardNode>(board.nodes.map((n) => [n.id, n]));
  const sourceConnectingNode = connectingSource ? nodeMap.get(connectingSource) : null;
  const targetConnectingNode = connectingTarget ? nodeMap.get(connectingTarget) : null;

  // Bidirectional & parallel edge detection for automatic non-overlapping separation
  const bidirectionalMap = useMemo(() => {
    const map = new Map<EdgeId, number>();
    const pairMap = new Map<string, EdgeId[]>();

    for (const edge of board.edges) {
      const key = [edge.source, edge.target].sort().join(':::');
      const list = pairMap.get(key) ?? [];
      list.push(edge.id);
      pairMap.set(key, list);
    }

    for (const ids of pairMap.values()) {
      if (ids.length >= 2) {
        ids.forEach((id, index) => {
          const offset =
            index % 2 === 0 ? -24 * (Math.floor(index / 2) + 1) : 24 * (Math.floor(index / 2) + 1);
          map.set(id, offset);
        });
      }
    }

    return map;
  }, [board.edges]);

  return (
    <div className="board-canvas-container" ref={containerRef}>
      {/* 1. Permanent Excalidraw-Grade Centered Floating Canvas Toolbox */}
      <div className="canvas-floating-toolbox" role="toolbar" aria-label="Canvas Interactive Tools">
        <div className="toolbox-tools-group">
          {/* Select Tool */}
          <button
            type="button"
            className={`toolbox-btn ${activeTool === 'select' || activeTool === 'marquee' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Pointer / Select Tool (Key: V) - Click to select, drag to box-select, double-click & hold in free space to move canvas"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M4 3l12 9-5.5 1 4 7-2.5 1.5-4-7-4 4.5z" />
            </svg>
            <span className="toolbox-shortcut">V</span>
          </button>

          {/* Smooth Pen Tool */}
          <button
            type="button"
            className={`toolbox-btn ${activeTool === 'pen' ? 'active' : ''}`}
            onClick={() => setActiveTool('pen')}
            title="Freehand Pen Tool (Key: P) - Draw failure boundaries & sketches"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <span className="toolbox-shortcut">P</span>
          </button>

          {/* Highlighter Tool */}
          <button
            type="button"
            className={`toolbox-btn ${activeTool === 'highlighter' ? 'active' : ''}`}
            onClick={() => setActiveTool('highlighter')}
            title="Highlighter Tool (Key: H) - Highlight blast radius & critical paths"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15.5 3H19a2 2 0 0 1 2 2v3.5a1 1 0 0 1-.29.71l-8.5 8.5a1 1 0 0 1-.71.29H8a2 2 0 0 1-2-2v-3.5a1 1 0 0 1 .29-.71l8.5-8.5A1 1 0 0 1 15.5 3z" />
              <path d="M5 19l-3 2" />
            </svg>
            <span className="toolbox-shortcut">H</span>
          </button>

          {/* Eraser Tool */}
          <button
            type="button"
            className={`toolbox-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setActiveTool('eraser')}
            title="Eraser Tool (Key: E) - Click or drag across strokes to erase"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2C14 1 16 1 17 2L21 6C22 7 22 9 21 10L14 17" />
              <path d="M6 11L16 21" />
            </svg>
            <span className="toolbox-shortcut">E</span>
          </button>
        </div>

        {/* Dynamic Pen & Highlighter Controls Sub-dock */}
        {(activeTool === 'pen' || activeTool === 'highlighter') && (
          <div className="toolbox-pen-subdock">
            <div className="toolbox-divider" />

            {/* Color Swatches */}
            <div className="pen-color-swatches">
              {[
                { hex: '#38bdf8', label: 'Cyan' },
                { hex: '#10b981', label: 'Emerald' },
                { hex: '#f59e0b', label: 'Amber' },
                { hex: '#f43f5e', label: 'Rose' },
                { hex: '#c084fc', label: 'Purple' },
                { hex: '#ffffff', label: 'White' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`color-swatch-dot ${penColor === c.hex ? 'active' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setPenColor(c.hex)}
                  title={`Stroke Color: ${c.label}`}
                />
              ))}
            </div>

            {/* Stroke Width Toggle */}
            <div className="pen-width-switches">
              {[
                { width: 2, label: 'Thin' },
                { width: 4, label: 'Medium' },
                { width: 7, label: 'Thick' },
              ].map((w) => (
                <button
                  key={w.width}
                  type="button"
                  className={`width-swatch-btn ${penWidth === w.width ? 'active' : ''}`}
                  onClick={() => setPenWidth(w.width)}
                  title={`Stroke Width: ${w.label}`}
                >
                  <span
                    className="width-sample-line"
                    style={{ height: w.width, backgroundColor: penColor }}
                  />
                </button>
              ))}
            </div>

            {/* Undo Last Stroke */}
            {onUndoStroke && (board.strokes?.length ?? 0) > 0 && (
              <button
                type="button"
                className="toolbox-sub-btn"
                onClick={onUndoStroke}
                title="Undo last stroke (Cmd+Z)"
              >
                ↩
              </button>
            )}

            {/* Clear All Drawings */}
            {onClearStrokes && (board.strokes?.length ?? 0) > 0 && (
              <button
                type="button"
                className="toolbox-sub-btn danger"
                onClick={onClearStrokes}
                title="Clear all drawings"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Echma SRE Permission Speaking Request Badge (Next to Draw Tools) */}
        {echmaSpeakingRequest?.isRequested && (
          <div className="toolbox-echma-allow-badge" role="alert" aria-live="polite">
            <div className="toolbox-divider" />
            <div className="echma-badge-content">
              <span className="echma-alert-dot" />
              <div className="echma-badge-avatar">
                <FemaleArchitectIcon size={15} strokeWidth={2} />
              </div>
              <span className="echma-badge-text">
                <strong>Echma:</strong> Wait... {echmaSpeakingRequest.hostName || 'Engineer'}?
              </span>
              <button
                type="button"
                className="echma-badge-allow-btn"
                onClick={echmaSpeakingRequest.onAllow}
                title="Hear Echma speak her findings"
              >
                Listen
              </button>
              {echmaSpeakingRequest.onAutoRemediate && (
                <button
                  type="button"
                  className="echma-badge-heal-btn"
                  onClick={echmaSpeakingRequest.onAutoRemediate}
                  title="Apply recommended resilience policy directly to the architecture"
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '4px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  Remediate Policy
                </button>
              )}
              <button
                type="button"
                className="echma-badge-dismiss-btn"
                onClick={echmaSpeakingRequest.onDismiss}
                title="Dismiss Echma speaking prompt"
                aria-label="Dismiss alert"
              >
                &times;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1.1 Architectural Hazard Alert Banner (Positioned directly below draw tools in whiteboard) */}
      {hazardBanner && hazardBanner.hazardCount > 0 && (
        <div className="canvas-hazard-banner" role="alert" aria-live="assertive">
          <span className="canvas-hazard-dot" />
          <span className="canvas-hazard-text">
            Echma flagged {hazardBanner.hazardCount} architectural hazard{hazardBanner.hazardCount > 1 ? 's' : ''}.
          </span>
          <button
            type="button"
            className="canvas-hazard-review-btn"
            onClick={hazardBanner.onReviewFinding}
            title="Inspect hazard details and blast radius analysis"
          >
            Review Finding
          </button>
          {hazardBanner.onAutoRemediate && (
            <button
              type="button"
              className="canvas-hazard-remediate-btn"
              onClick={hazardBanner.onAutoRemediate}
              title="Apply recommended resilience policy directly to the architecture"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Remediate
            </button>
          )}
          {hazardBanner.onDismiss && (
            <button
              type="button"
              className="echma-badge-dismiss-btn"
              onClick={hazardBanner.onDismiss}
              title="Dismiss hazard banner"
              aria-label="Dismiss alert"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* 2. Floating Zoom Controls */}
      <div className="canvas-zoom-dock" role="toolbar" aria-label="Canvas zoom controls">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
          title="Zoom out"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.min(3.0, z + 0.15))}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="zoom-btn-fit"
          onClick={handleResetZoom}
          title="Reset to 100% and center"
        >
          Reset
        </button>
      </div>

      {/* 4. Infinite SVG Canvas Scene */}
      <svg
        ref={svgRef}
        className={`canvas-svg ${isSpacePressed || isPanningState ? 'canvas-panning' : ''} ${
          activeTool === 'pen' || activeTool === 'highlighter' ? 'canvas-drawing' : ''
        } ${activeTool === 'eraser' ? 'canvas-erasing' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
      >
        <defs>
          <pattern
            id="canvas-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${String(pan.x)}, ${String(pan.y)}) scale(${String(zoom)})`}
          >
            <circle cx="2" cy="2" r="1" fill="var(--canvas-dot)" />
          </pattern>

          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="#64748b" />
          </marker>
          <marker
            id="arrow-selected"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="var(--color-accent)" />
          </marker>
          <marker
            id="arrow-hazard"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="7.5"
            markerHeight="7.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="#ff1744" />
          </marker>
        </defs>

        {/* Matrix Grid (Infinite Canvas Area) */}
        <rect id="canvas-matrix-bg" width="100%" height="100%" fill="url(#canvas-grid)" />

        {/* Zoomed & Panned Scene Container */}
        <g transform={`translate(${String(pan.x)}, ${String(pan.y)}) scale(${String(zoom)})`}>
          {/* Layer A: Persistent Freehand Sketches & Drawings */}
          <g className="canvas-strokes-layer">
            {(board.strokes ?? []).map((stroke) => {
              const pathData = pointsToSmoothPath(stroke.points);
              return (
                <g key={stroke.id} className="canvas-stroke-group">
                  {/* Invisible wide hit target for effortless eraser clicking & hovering */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(stroke.width * 2.5, 24)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      cursor: activeTool === 'eraser' ? 'pointer' : 'default',
                      pointerEvents: activeTool === 'eraser' ? 'stroke' : 'none',
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'eraser' && onDeleteStroke) {
                        e.stopPropagation();
                        onDeleteStroke(stroke.id);
                      }
                    }}
                  />
                  {/* Visual Stroke Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={stroke.tool === 'highlighter' ? 0.35 : 0.9}
                    style={{
                      pointerEvents: 'none',
                    }}
                  />
                </g>
              );
            })}

            {/* Live Stroke in progress */}
            {currentStroke && (
              <path
                d={pointsToSmoothPath(currentStroke)}
                fill="none"
                stroke={penColor}
                strokeWidth={activeTool === 'highlighter' ? penWidth * 3.5 : penWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={activeTool === 'highlighter' ? 0.4 : 0.95}
              />
            )}
          </g>

          {/* Layer B: Edges */}
          {board.edges.map((edge) => {
            // If this edge is currently being reconnected, hide its static target path so the live dragged rubberband takes over seamlessly
            if (reconnectingEdgeId === edge.id) return null;

            return (
              <EdgeLink
                key={edge.id}
                edge={edge}
                sourceNode={nodeMap.get(edge.source)}
                targetNode={nodeMap.get(edge.target)}
                isSelected={board.selectedEdgeId === edge.id}
                isHazard={hazardEdgeId === edge.id}
                problems={board.validationProblems}
                controlPoint={board.edgeControlPoints?.[edge.id] ?? null}
                bidirectionalOffset={bidirectionalMap.get(edge.id) ?? 0}
                sourceSide={board.edgeSourcePorts?.[edge.id]}
                targetSide={board.edgeTargetPorts?.[edge.id]}
                onSelect={onSelectEdge}
                onDragControlPointStart={handleEdgeControlPointDragStart}
                onStartReconnectSource={handleStartReconnectSource}
                onStartReconnectTarget={handleStartReconnectTarget}
                onResetControlPoint={(id) => onUpdateEdgeControlPoint?.(id, null)}
              />
            );
          })}

          {/* Layer C: Live Dragged Wire (Rubberband Connection Preview) */}
          {sourceConnectingNode && connectingCursor && (
            <path
              d={computeRubberbandRoute(
                sourceConnectingNode.position,
                connectingCursor,
                184,
                76,
                connectingPort,
              )}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeDasharray="5 3"
              markerEnd="url(#arrow-selected)"
              className="rubberband-wire"
            />
          )}
          {targetConnectingNode && connectingCursor && (
            <path
              d={computeRubberbandRoute(
                connectingCursor,
                targetConnectingNode.position,
                184,
                76,
                'right',
              )}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeDasharray="5 3"
              markerEnd="url(#arrow-selected)"
              className="rubberband-wire"
            />
          )}

          {/* Layer D: Topology Node Cards */}
          {board.nodes.map((node, index) => (
            <NodeCard
              key={node.id}
              node={node}
              nodeNumber={index + 1}
              isSelected={board.selectedNodeId === node.id}
              isMultiSelected={selectedNodeSet.has(node.id)}
              isEntry={board.entryNodeId === node.id}
              isHazard={hazardNodeId === node.id}
              isConnecting={connectingSource !== null}
              problems={board.validationProblems}
              onSelect={onSelectNode}
              onDragStart={handleDragStart}
              onStartConnect={handleStartConnect}
              onDropConnect={handleDropConnect}
            />
          ))}

          {/* Layer E: Marquee Crop / Box Selection Dynamic Rectangle */}
          {marqueeBox && (
            <rect
              x={Math.min(marqueeBox.startX, marqueeBox.currentX)}
              y={Math.min(marqueeBox.startY, marqueeBox.currentY)}
              width={Math.abs(marqueeBox.currentX - marqueeBox.startX)}
              height={Math.abs(marqueeBox.currentY - marqueeBox.startY)}
              className="canvas-marquee-box"
              fill="rgba(56, 189, 248, 0.12)"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Layer F: Remote Reviewer Cursors (Figma Presence) */}
          {remoteCursors
            .filter((rc) => rc.cursor && rc.cursor.x > 0 && rc.cursor.y > 0)
            .map((rc) => (
            <g
              key={rc.userId}
              transform={`translate(${String(rc.cursor.x)}, ${String(rc.cursor.y)})`}
              className="remote-presence-cursor"
              style={{ pointerEvents: 'none' }}
            >
              <path
                d="M 0 0 L 0 16 L 4.5 12.5 L 8 18 L 10.5 16.5 L 7 11 L 12 11 Z"
                fill="#0866ff"
                stroke="#ffffff"
                strokeWidth={1}
              />
              <g transform="translate(12, 14)">
                <rect
                  x={0}
                  y={0}
                  width={rc.name.length * 6.5 + 16}
                  height={18}
                  rx={4}
                  fill="#0866ff"
                />
                <text
                  x={8}
                  y={12}
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="var(--font-sans)"
                >
                  {rc.name}
                </text>
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
