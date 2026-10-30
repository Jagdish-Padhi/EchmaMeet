import React, { useState, useRef } from 'react';
import type { CandidateEdge, RedStrokePoint } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';

export interface RedStrokeCanvasProps {
  readonly candidateEdges: readonly CandidateEdge[];
  readonly onDetect: (stroke: RedStrokePoint[]) => void;
  readonly isDetecting: boolean;
}

export const RedStrokeCanvas: React.FC<RedStrokeCanvasProps> = ({
  candidateEdges,
  onDetect,
  isDetecting,
}) => {
  const [points, setPoints] = useState<RedStrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const getNormalizedPoint = (e: React.MouseEvent<SVGSVGElement>): RedStrokePoint | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = getNormalizedPoint(e);
    if (pt) {
      setIsDrawing(true);
      setPoints([pt]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const pt = getNormalizedPoint(e);
    if (pt) {
      setPoints((prev) => [...prev, pt]);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleSimulateFirstEdgeCut = () => {
    const firstEdge = candidateEdges[0];
    if (firstEdge) {
      const p1 = firstEdge.polyline[0] ?? [0.3, 0.4];
      const p2 = firstEdge.polyline[firstEdge.polyline.length - 1] ?? [0.5, 0.4];
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;
      const simulatedStroke: RedStrokePoint[] = [
        [midX, Math.max(0, midY - 0.15)],
        [midX, Math.min(1, midY + 0.15)],
      ];
      setPoints(simulatedStroke);
      onDetect(simulatedStroke);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
          Red-Stroke Chaos Gesture
        </h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSimulateFirstEdgeCut}
            disabled={candidateEdges.length === 0 || isDetecting}
          >
            Cut First Edge
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPoints([])}
            disabled={points.length === 0 || isDetecting}
          >
            Clear Stroke
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onDetect(points)}
            disabled={points.length < 2 || isDetecting}
          >
            {isDetecting ? 'Detecting...' : 'Detect Stroke'}
          </Button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          background: '#ffffff',
          position: 'relative',
          height: 180,
          cursor: 'crosshair',
        }}
      >
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Candidate edges */}
          {candidateEdges.map((edge) => {
            const p1 = edge.polyline[0];
            const p2 = edge.polyline[edge.polyline.length - 1];
            if (!p1 || !p2) return null;
            return (
              <g key={edge.id}>
                <line
                  x1={p1[0] * 100}
                  y1={p1[1] * 100}
                  x2={p2[0] * 100}
                  y2={p2[1] * 100}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <text
                  x={(p1[0] + p2[0]) * 50}
                  y={(p1[1] + p2[1]) * 50 - 2}
                  fontSize="3"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {edge.source} -&gt; {edge.target}
                </text>
              </g>
            );
          })}

          {/* Drawn red stroke */}
          {points.length >= 2 && (
            <polyline
              points={points.map((p) => `${String(p[0] * 100)},${String(p[1] * 100)}`).join(' ')}
              fill="none"
              stroke="#dc2626"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b' }}>
        Draw a stroke cutting across an edge line in red to target it for fault injection.
      </p>
    </div>
  );
};
