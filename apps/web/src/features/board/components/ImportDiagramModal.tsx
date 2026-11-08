import { useState, useId } from 'react';
import { Button } from '../../../components/ui/Button';
import {
  MERMAID_TEMPLATES,
  parseMermaidArchitecture,
  type ArchitectureTemplate,
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
    name?: string,
  ) => void;
}

export function ImportDiagramModal({ isOpen, onClose, onImport }: ImportDiagramModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    MERMAID_TEMPLATES[0]?.id ?? 'aws-microservices',
  );
  const [code, setCode] = useState<string>(MERMAID_TEMPLATES[0]?.code ?? '');
  const [copied, setCopied] = useState(false);
  const editorId = useId();

  if (!isOpen) return null;

  const activeTemplate: ArchitectureTemplate | undefined = MERMAID_TEMPLATES.find(
    (t) => t.id === selectedTemplateId,
  );

  const parseResult: MermaidParseResult = parseMermaidArchitecture(code);

  const handleSelectTemplate = (template: ArchitectureTemplate) => {
    setSelectedTemplateId(template.id);
    setCode(template.code);
  };

  const handleResetTemplate = () => {
    if (activeTemplate) {
      setCode(activeTemplate.code);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed or unpermitted
    }
  };

  const handleApply = () => {
    if (parseResult.success) {
      onImport(
        parseResult.nodes,
        parseResult.edges,
        parseResult.entryNodeId,
        activeTemplate?.name ?? 'Imported Architecture',
      );
      onClose();
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="import-diagram-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-diagram-title"
      >
        {/* Enterprise Modal Header */}
        <div className="import-modal-header">
          <div className="import-modal-identity">
            <div className="import-modal-emblem" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div>
              <div className="import-modal-title" id="import-diagram-title">
                Import Architecture Topology
              </div>
              <div className="import-modal-subtitle">
                Select industry-standard reference designs or paste custom Mermaid.js flowchart definitions
              </div>
            </div>
          </div>
          <button
            type="button"
            className="import-modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Template Catalog Section */}
        <div className="import-templates-section">
          <div className="import-templates-label-row">
            <span className="import-section-heading">PRODUCTION ARCHITECTURE TEMPLATES</span>
            <span className="import-section-counter">{MERMAID_TEMPLATES.length} PRE-CONFIGURED PATTERNS</span>
          </div>

          <div className="import-templates-scroll-row">
            {MERMAID_TEMPLATES.map((tmpl) => {
              const isSelected = tmpl.id === selectedTemplateId;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  className={`import-template-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectTemplate(tmpl)}
                >
                  <span className="import-template-category-tag">{tmpl.category}</span>
                  <span className="import-template-name">{tmpl.name}</span>
                </button>
              );
            })}
          </div>

          {activeTemplate && (
            <div className="import-template-detail-box">
              <div className="import-template-description-text">{activeTemplate.description}</div>
              <div className="import-template-highlights-row">
                <span className="import-highlights-label">Guaranteed Patterns:</span>
                {activeTemplate.highlights.map((h) => (
                  <span key={h} className="import-highlight-pill">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* High-Contrast Code Editor Section */}
        <div className="import-editor-section">
          <div className="import-editor-toolbar">
            <div className="import-editor-meta-left">
              <span className="import-syntax-badge">Mermaid v10 Flowchart</span>
              <span className="import-editor-stat">{lineCount} lines</span>
            </div>
            <div className="import-editor-actions-right">
              <button
                type="button"
                className="import-editor-btn"
                onClick={handleCopyCode}
                title="Copy diagram code to clipboard"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="import-editor-btn"
                onClick={handleResetTemplate}
                title="Reset code to current template default"
              >
                Reset
              </button>
              <button
                type="button"
                className="import-editor-btn"
                onClick={() => setCode('')}
                title="Clear editor"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="import-code-container">
            <textarea
              id={editorId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={9}
              className="import-code-textarea"
              placeholder="graph TD&#10;  gateway[API Gateway] --> orders[Order Service]&#10;  orders --> db[(PostgreSQL Primary)]"
              spellCheck={false}
              aria-label="Mermaid diagram code"
            />
          </div>

          {/* Live Validation & Preflight Diagnostics Bar */}
          {parseResult.success ? (
            <div className="import-diagnostic-box success">
              <div className="import-diagnostic-status">
                <span className="import-status-dot success" />
                <span className="import-status-title">Syntax Valid & Topology Ready</span>
              </div>
              <div className="import-diagnostic-metrics">
                <span className="import-metric-chip">
                  <strong>{parseResult.nodes.length}</strong> Nodes
                </span>
                <span className="import-metric-chip">
                  <strong>{parseResult.edges.length}</strong> Edges
                </span>
                <span className="import-metric-chip">
                  Entry: <code>{parseResult.entryNodeId}</code>
                </span>
                <span className="import-metric-chip preflight-chip">
                  ✓ Preflight Compliant
                </span>
              </div>
            </div>
          ) : (
            <div className="import-diagnostic-box error">
              <div className="import-diagnostic-status">
                <span className="import-status-dot error" />
                <span className="import-status-title">Mermaid Parse Error</span>
              </div>
              <div className="import-error-message">{parseResult.error}</div>
            </div>
          )}
        </div>

        {/* Enterprise Modal Footer */}
        <div className="import-modal-footer">
          <div className="import-syntax-hints">
            <span>Syntax:</span>
            <code>node[Service]</code>
            <code>queue&gt;Worker]</code>
            <code>db[(Sink)]</code>
            <code>redis[(Cache)]</code>
          </div>
          <div className="import-modal-footer-actions">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={!parseResult.success || parseResult.nodes.length === 0}
            >
              Import to Canvas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}