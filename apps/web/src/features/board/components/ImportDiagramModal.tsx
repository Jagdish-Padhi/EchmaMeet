import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import {
  MERMAID_TEMPLATES,
  parseMermaidArchitecture,
  type MermaidParseResult,
} from '../utils/mermaid-parser';
import type { BoardNode } from '../types';
import type { NodeId, TopologyEdge } from '@chaosboard/contracts';

export interface ImportDiagramModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onImport: (
    nodes: readonly BoardNode[],
    edges: readonly TopologyEdge[],
    entryNodeId: NodeId,
  ) => void;
}

export function ImportDiagramModal({ isOpen, onClose, onImport }: ImportDiagramModalProps) {
  const [code, setCode] = useState<string>(MERMAID_TEMPLATES[0]?.code ?? '');

  if (!isOpen) return null;

  const parseResult: MermaidParseResult = parseMermaidArchitecture(code);

  const handleApply = () => {
    if (parseResult.success) {
      onImport(parseResult.nodes, parseResult.edges, parseResult.entryNodeId);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="sre-yield-modal-card"
        style={{ maxWidth: 680, width: '92%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-diagram-title"
      >
        {/* Header */}
        <div className="sre-modal-header">
          <div className="sre-agent-identity">
            <div className="sre-agent-emblem">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <div className="sre-agent-name" id="import-diagram-title">
                Import Architecture Diagram
              </div>
              <div className="sre-agent-subtitle">
                Ingest Mermaid.js flowcharts or load proven production patterns
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-drawer"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Templates */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Templates:
          </span>
          {MERMAID_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              type="button"
              className={`studio-action-pill ${code.trim() === tmpl.code.trim() ? 'active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => setCode(tmpl.code)}
              title={tmpl.description}
            >
              {tmpl.name}
            </button>
          ))}
        </div>

        {/* Textarea Editor */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label
            htmlFor="mermaid-editor-input"
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Mermaid Syntax (graph TD / flowchart LR)</span>
            <span>Auto DAG coordinates will be computed</span>
          </label>
          <textarea
            id="mermaid-editor-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-canvas-dark, #0d1117)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '12px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              resize: 'vertical',
            }}
            placeholder="graph TD&#10;  gateway[API Gateway] --> orders[Order Service]&#10;  orders --> db[(PostgreSQL)]"
          />

          {/* Validation & Preview Summary */}
          {parseResult.success ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '10px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 6,
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: 'var(--accent, #38bdf8)', fontWeight: 600 }}>
                Parsed Successfully
              </span>
              <span style={{ color: 'var(--text-subtle)' }}>Nodes: {parseResult.nodes.length}</span>
              <span style={{ color: 'var(--text-subtle)' }}>Edges: {parseResult.edges.length}</span>
              <span style={{ color: 'var(--text-subtle)' }}>Entry: {parseResult.entryNodeId}</span>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                fontSize: '0.8rem',
                color: '#f87171',
              }}
            >
              Syntax Error: {parseResult.error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sre-modal-footer">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply} disabled={!parseResult.success}>
            Import to Canvas
          </Button>
        </div>
      </div>
    </div>
  );
}
