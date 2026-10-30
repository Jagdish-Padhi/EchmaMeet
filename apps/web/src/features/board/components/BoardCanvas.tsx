import { useCallback, useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import type { EdgeId, NodeId, NodeKind } from '@chaosboard/contracts';
import type { BoardNode, BoardState } from '../types';
import { EdgeLink } from './EdgeLink';
import { NodeCard } from './NodeCard';
import { computeRubberbandRoute } from '../utils/edge-router';

export interface BoardCanvasProps {
  readonly board: BoardState;
  readonly onSelectNode: (id: NodeId | null) => void;
  readonly onSelectEdge: (id: EdgeId | null) => void;
  readonly onMoveNode: (id: NodeId, x: number, y: number) => void;
  readonly onAddNode: (kind?: NodeKind) => void;
  readonly onAddEdge: (source: NodeId, target: NodeId) => void;
  readonly onDuplicateNode?: (id: NodeId) => void;
  readonly onDeleteNode?: (id: NodeId) => void;
  readonly onDeleteEdge?: (id: EdgeId) => void;
  readonly hazardEdgeId?: EdgeId | null;
  readonly hazardNodeId?: NodeId | null;
}

export function BoardCanvas({
  board,
  onSelectNode,
  onSelectEdge,
  onMoveNode,
  onAddNode,
  onAddEdge,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  hazardEdgeId,
  hazardNodeId,
}: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan & Zoom State (Excalidraw / Breakscale grade)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Wire Connection Dragging State
  const [connectingSource, setConnectingSource] = useState<NodeId | null>(null);
  const [connectingCursor, setConnectingCursor] = useState<{ x: number; y: number } | null>(null);
  const connectStartPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hasMovedWireRef = useRef(false);

  // Node Dragging State
  const draggingNodeRef = useRef<{
    id: NodeId;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Fast Keyboard Shortcuts: Ctrl+D duplicate, Del/Backspace remove, 1-4 quick add, Esc deselect, Space pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or select
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Space to Pan
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      // Ctrl+D or Cmd+D to Duplicate Selected Node
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (board.selectedNodeId && onDuplicateNode) {
          e.preventDefault();
          onDuplicateNode(board.selectedNodeId);
        }
      }

      // Delete or Backspace to Remove Selected Element
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (board.selectedNodeId && onDeleteNode) {
          e.preventDefault();
          onDeleteNode(board.selectedNodeId);
        } else if (board.selectedEdgeId && onDeleteEdge) {
          e.preventDefault();
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

      // Escape to Deselect / Cancel Wire
      if (e.key === 'Escape') {
        onSelectNode(null);
        onSelectEdge(null);
        setConnectingSource(null);
        setConnectingCursor(null);
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
    onDeleteNode,
    onDeleteEdge,
    onSelectNode,
    onSelectEdge,
  ]);

  // Convert screen coordinates to canvas space (accounting for pan & zoom)
  const screenToCanvasCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!svgRef.current) return { x: clientX, y: clientY };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  // Node Drag Start
  const handleDragStart = (id: NodeId, e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    const node = board.nodes.find((n) => n.id === id);
    if (!node) return;
    draggingNodeRef.current = {
      id,
      startX: node.position.x,
      startY: node.position.y,
      clientX: e.clientX,
      clientY: e.clientY,
    };
  };

  // Start wire dragging from output handle
  const handleStartConnect = (sourceId: NodeId, e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    setConnectingSource(sourceId);
    setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
    connectStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasMovedWireRef.current = false;
  };

  // Drop wire on target node
  const handleDropConnect = (targetId: NodeId) => {
    if (connectingSource && connectingSource !== targetId) {
      onAddEdge(connectingSource, targetId);
    }
    setConnectingSource(null);
    setConnectingCursor(null);
    connectStartPosRef.current = null;
    hasMovedWireRef.current = false;
  };

  // Canvas Mouse Down: Start Pan if Space pressed or Middle-Click
  const handleCanvasMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressed) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
      return;
    }

    // Left click on empty canvas deselects and cancels active wire
    if (e.target === svgRef.current || (e.target as SVGElement).id === 'canvas-matrix-bg') {
      onSelectNode(null);
      onSelectEdge(null);
      setConnectingSource(null);
      setConnectingCursor(null);
      connectStartPosRef.current = null;
      hasMovedWireRef.current = false;
    }
  };

  // Canvas Mouse Move: Handles Panning, Node Dragging, or Wire Dragging
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    // 1. Panning
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    // 2. Wire Connection Dragging / Moving
    if (connectingSource) {
      setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
      if (connectStartPosRef.current) {
        const dX = Math.abs(e.clientX - connectStartPosRef.current.clientX);
        const dY = Math.abs(e.clientY - connectStartPosRef.current.clientY);
        if (dX > 6 || dY > 6) {
          hasMovedWireRef.current = true;
        }
      }
      return;
    }

    // 3. Node Dragging
    if (draggingNodeRef.current) {
      const { id, startX, startY, clientX, clientY } = draggingNodeRef.current;
      const dx = (e.clientX - clientX) / zoom;
      const dy = (e.clientY - clientY) / zoom;
      onMoveNode(id, Math.round(startX + dx), Math.round(startY + dy));
    }
  };

  // Global Window Listeners for Seamless Sticky Dragging & Panning
  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      // 1. Panning
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
        return;
      }

      // 2. Wire Connection Dragging / Moving
      if (connectingSource) {
        setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
        if (connectStartPosRef.current) {
          const dX = Math.abs(e.clientX - connectStartPosRef.current.clientX);
          const dY = Math.abs(e.clientY - connectStartPosRef.current.clientY);
          if (dX > 6 || dY > 6) {
            hasMovedWireRef.current = true;
          }
        }
        return;
      }

      // 3. Node Dragging - seamlessly glued to cursor with zero lag
      if (draggingNodeRef.current) {
        const { id, startX, startY, clientX, clientY } = draggingNodeRef.current;
        const dx = (e.clientX - clientX) / zoom;
        const dy = (e.clientY - clientY) / zoom;
        onMoveNode(id, Math.round(startX + dx), Math.round(startY + dy));
      }
    };

    const handleGlobalMouseUp = () => {
      isPanningRef.current = false;
      draggingNodeRef.current = null;
      if (connectingSource && hasMovedWireRef.current) {
        setConnectingSource(null);
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
  }, [connectingSource, onMoveNode, pan.x, pan.y, screenToCanvasCoords, zoom]);

  // Canvas Mouse Up
  const handleMouseUp = () => {
    isPanningRef.current = false;
    draggingNodeRef.current = null;
    // Only cancel wire on mouseUp if the user was actively dragging and released over empty space
    if (connectingSource && hasMovedWireRef.current) {
      setConnectingSource(null);
      setConnectingCursor(null);
      connectStartPosRef.current = null;
      hasMovedWireRef.current = false;
    }
  };

  // Mouse Wheel Zoom: Zoom smoothly toward cursor position
  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomDelta = e.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(2.5, Math.max(0.35, zoom * zoomDelta));

    // Pivot pan around mouse cursor
    const nextPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const nextPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const nodeMap = new Map<NodeId, BoardNode>(board.nodes.map((n) => [n.id, n]));
  const sourceConnectingNode = connectingSource ? nodeMap.get(connectingSource) : null;

  return (
    <div className="board-canvas-container">
      {/* Floating Excalidraw-Grade Zoom Controls */}
      <div className="canvas-zoom-dock" role="toolbar" aria-label="Canvas zoom controls">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
          title="Zoom out"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
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

      <svg
        ref={svgRef}
        className={`canvas-svg ${isSpacePressed ? 'canvas-panning' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="canvas-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="var(--canvas-dot)" />
          </pattern>
          {/* Sleek Excalidraw / Breakscale Sharp Arrowhead */}
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
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="5"
              floodColor="var(--color-accent)"
              floodOpacity="0.35"
            />
          </filter>
        </defs>

        {/* Matrix Grid (Infinite Canvas Area) */}
        <rect id="canvas-matrix-bg" width="100%" height="100%" fill="url(#canvas-grid)" />

        {/* Zoomed & Panned Scene Container */}
        <g transform={`translate(${String(pan.x)}, ${String(pan.y)}) scale(${String(zoom)})`}>
          {/* Edges */}
          {board.edges.map((edge) => (
            <EdgeLink
              key={edge.id}
              edge={edge}
              sourceNode={nodeMap.get(edge.source)}
              targetNode={nodeMap.get(edge.target)}
              isSelected={board.selectedEdgeId === edge.id}
              isHazard={hazardEdgeId === edge.id}
              problems={board.validationProblems}
              onSelect={onSelectEdge}
            />
          ))}

          {/* Live Dragged Wire (Rubberband Connection Preview) */}
          {sourceConnectingNode && connectingCursor && (
            <path
              d={computeRubberbandRoute(sourceConnectingNode.position, connectingCursor, 184, 76)}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeDasharray="5 3"
              markerEnd="url(#arrow-selected)"
              className="rubberband-wire"
            />
          )}

          {/* Nodes */}
          {board.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={board.selectedNodeId === node.id}
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
        </g>
      </svg>
    </div>
  );
}
