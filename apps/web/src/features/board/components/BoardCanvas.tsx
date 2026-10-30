import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import type { EdgeId, NodeId, NodeKind } from '@chaosboard/contracts';
import type { BoardNode, BoardState } from '../types';
import { EdgeLink } from './EdgeLink';
import { NodeCard } from './NodeCard';

export interface BoardCanvasProps {
  readonly board: BoardState;
  readonly onSelectNode: (id: NodeId | null) => void;
  readonly onSelectEdge: (id: EdgeId | null) => void;
  readonly onMoveNode: (id: NodeId, x: number, y: number) => void;
  readonly onAddNode: (kind?: NodeKind) => void;
  readonly onAddEdge: (source: NodeId, target: NodeId) => void;
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
  onAddEdge,
  onDeleteNode,
  onDeleteEdge,
  hazardEdgeId,
  hazardNodeId,
}: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan & Zoom State (Excalidraw / Figma grade)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Wire Connection Dragging State
  const [connectingSource, setConnectingSource] = useState<NodeId | null>(null);
  const [connectingCursor, setConnectingCursor] = useState<{ x: number; y: number } | null>(null);

  // Node Dragging State
  const draggingNodeRef = useRef<{
    id: NodeId;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Keyboard Shortcuts: Delete/Backspace to remove, Esc to deselect, Space to pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or select
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (board.selectedNodeId && onDeleteNode) {
          e.preventDefault();
          onDeleteNode(board.selectedNodeId);
        } else if (board.selectedEdgeId && onDeleteEdge) {
          e.preventDefault();
          onDeleteEdge(board.selectedEdgeId);
        }
      }

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
    onDeleteNode,
    onDeleteEdge,
    onSelectNode,
    onSelectEdge,
  ]);

  // Convert screen coordinates to canvas space (accounting for pan & zoom)
  const screenToCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!svgRef.current) return { x: clientX, y: clientY };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

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
  };

  // Drop wire on target node
  const handleDropConnect = (targetId: NodeId) => {
    if (connectingSource && connectingSource !== targetId) {
      onAddEdge(connectingSource, targetId);
    }
    setConnectingSource(null);
    setConnectingCursor(null);
  };

  // Canvas Mouse Down: Start Pan if Space pressed or Middle-Click
  const handleCanvasMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressed) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
      return;
    }

    // Left click on empty canvas deselects
    if (e.target === svgRef.current || (e.target as SVGElement).id === 'canvas-matrix-bg') {
      onSelectNode(null);
      onSelectEdge(null);
      setConnectingSource(null);
      setConnectingCursor(null);
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

    // 2. Wire Connection Dragging
    if (connectingSource) {
      setConnectingCursor(screenToCanvasCoords(e.clientX, e.clientY));
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

  // Canvas Mouse Up
  const handleMouseUp = () => {
    isPanningRef.current = false;
    draggingNodeRef.current = null;
    if (connectingSource) {
      setConnectingSource(null);
      setConnectingCursor(null);
    }
  };

  // Mouse Wheel Zoom: Zoom toward cursor position
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
    <div className="canvas-container">
      {/* Zoom & Canvas Navigation Controls Overlay */}
      <div className="canvas-zoom-dock">
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
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
          <marker
            id="arrow-selected"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
          </marker>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="6"
              floodColor="var(--color-accent)"
              floodOpacity="0.45"
            />
          </filter>
        </defs>

        {/* Blueprint Matrix Grid (Infinite Canvas Area) */}
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
              d={`M ${String(sourceConnectingNode.position.x + 180)} ${String(
                sourceConnectingNode.position.y + 45,
              )} C ${String(sourceConnectingNode.position.x + 240)} ${String(
                sourceConnectingNode.position.y + 45,
              )}, ${String(connectingCursor.x - 60)} ${String(connectingCursor.y)}, ${String(
                connectingCursor.x,
              )} ${String(connectingCursor.y)}`}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeDasharray="6 3"
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
