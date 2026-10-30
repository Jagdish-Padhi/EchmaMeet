import React, { useState } from 'react';
import type { TopologyDraft, VisionExtraction } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';

export interface VisionDraftOverlayProps {
  readonly previewUrl: string;
  readonly extraction: VisionExtraction;
  readonly onConfirm: (draft: TopologyDraft) => void;
  readonly onCancel: () => void;
}

export const VisionDraftOverlay: React.FC<VisionDraftOverlayProps> = ({
  previewUrl,
  extraction,
  onConfirm,
  onCancel,
}) => {
  const [topologyName, setTopologyName] = useState('Hand-drawn Topology');

  const handleConfirm = () => {
    const draft: TopologyDraft = {
      name: topologyName,
      source: 'image',
      nodes: extraction.nodes.map((n) => ({
        ref: n.id,
        label: n.label,
        ...(n.kind ? { kind: n.kind } : {}),
      })),
      edges: extraction.edges.map((e) => ({
        sourceRef: e.sourceLabel,
        targetRef: e.targetLabel,
      })),
    };
    onConfirm(draft);
  };

  return (
    <Card title="Vision Extraction Review">
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#475569' }}>
          Verify the extracted nodes and edges below. Low confidence or ambiguous elements are
          highlighted.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>Topology Name:</label>
          <input
            type="text"
            value={topologyName}
            onChange={(e) => setTopologyName(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: 460,
          overflow: 'hidden',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: '#0f172a',
          marginBottom: 16,
        }}
      >
        <img
          src={previewUrl}
          alt="Architecture diagram upload"
          style={{ width: '100%', height: 'auto', display: 'block', opacity: 0.8 }}
        />
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Edges */}
          {extraction.edges.map((edge) => {
            if (!edge.polyline || edge.polyline.length < 2) return null;
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
                  stroke="#3b82f6"
                  strokeWidth="0.8"
                  strokeDasharray="1.5,1"
                />
              </g>
            );
          })}

          {/* Node boxes */}
          {extraction.nodes.map((node) => {
            if (!node.box) return null;
            const bx = node.box.x * 100;
            const by = node.box.y * 100;
            const bw = node.box.width * 100;
            const bh = node.box.height * 100;
            const isLowConf = node.confidence < 0.85;

            return (
              <g key={node.id}>
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke={isLowConf ? '#f59e0b' : '#3b82f6'}
                  strokeWidth="0.8"
                  rx="1"
                />
                <text
                  x={bx + 1}
                  y={by + bh / 2 + 1}
                  fill="#ffffff"
                  fontSize="3"
                  fontFamily="monospace"
                >
                  {node.label} ({Math.round(node.confidence * 100)}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {extraction.ambiguities.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Alert variant="warning">
            <strong>Ambiguities Detected:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {extraction.ambiguities.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {extraction.warnings.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Alert variant="info">
            <strong>Extraction Notes:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {extraction.warnings.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>
          Discard
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirm & Load into Canvas
        </Button>
      </div>
    </Card>
  );
};
