import { useRef, useState, type MouseEvent } from 'react';
import type { EdgeId, NodeId } from '@chaosboard/contracts';
import type { BoardNode, BoardState } from '../types';
import { EdgeLink } from './EdgeLink';
import { NodeCard } from './NodeCard';

export interface BoardCanvasProps {
  readonly board: BoardState;
  readonly onSelectNode: (id: NodeId | null) => void;
  readonly onSelectEdge: (id: EdgeId | null) => void;
  readonly onMoveNode: (id: NodeId, x: number, y: number) => void;
  readonly onAddNode: () => void;
  readonly onAddEdge: (source: NodeId, target: NodeId) => void;
}

export function BoardCanvas({
  board,
  onSelectNode,
  onSelectEdge,
  onMoveNode,
  onAddNode,
  onAddEdge,
}: BoardCanvasProps) {
  const [connectSource, setConnectSource] = useState<NodeId | null>(null);
  const draggingNodeRef = useRef<{
    id: NodeId;
    startX: number;
    startY: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const handleDragStart = (id: NodeId, e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    const node = board.nodes.find((n) => n.id === id);
    if (!node) return;
    draggingNodeRef.current = {
      id,
      startX: node.position.x,
      startY: node.position.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current) return;
    const { id, startX, startY, mouseX, mouseY } = draggingNodeRef.current;
    const dx = e.clientX - mouseX;
    const dy = e.clientY - mouseY;
    onMoveNode(id, Math.max(20, startX + dx), Math.max(20, startY + dy));
  };

  const handleMouseUp = () => {
    draggingNodeRef.current = null;
  };

  const handleCanvasClick = () => {
    onSelectNode(null);
    onSelectEdge(null);
    setConnectSource(null);
  };

  const handleNodeClick = (id: NodeId) => {
    if (connectSource && connectSource !== id) {
      onAddEdge(connectSource, id);
      setConnectSource(null);
      return;
    }
    onSelectNode(id);
  };

  const nodeMap = new Map<NodeId, BoardNode>(board.nodes.map((n) => [n.id, n]));

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddNode}>
          Add Service Node
        </button>
        {board.selectedNodeId && (
          <button
            type="button"
            className={`btn btn-sm ${connectSource ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setConnectSource(connectSource ? null : board.selectedNodeId)}
          >
            {connectSource ? 'Click Target Node to Connect...' : 'Connect to Another Node'}
          </button>
        )}
      </div>

      <svg
        className="canvas-svg"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <pattern id="canvas-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.08)" />
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Blueprint Matrix Grid */}
        <rect width="100%" height="100%" fill="url(#canvas-grid)" />

        {/* Edges */}
        {board.edges.map((edge) => (
          <EdgeLink
            key={edge.id}
            edge={edge}
            sourceNode={nodeMap.get(edge.source)}
            targetNode={nodeMap.get(edge.target)}
            isSelected={board.selectedEdgeId === edge.id}
            problems={board.validationProblems}
            onSelect={onSelectEdge}
          />
        ))}

        {/* Nodes */}
        {board.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={board.selectedNodeId === node.id}
            isEntry={board.entryNodeId === node.id}
            problems={board.validationProblems}
            onSelect={handleNodeClick}
            onDragStart={handleDragStart}
          />
        ))}
      </svg>
    </div>
  );
}
