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

  const handleCopyCode = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback if clipboard unpermitted
      }
    })();
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="import-diagram-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-diagram-title"
      >
        {/* Header */}
        <div className="import-modal-header">
          <div className="import-modal-title" id="import-diagram-title">
            Import Architecture
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

        {/* Clean Template Segmented Control */}
        <div className="import-templates-bar">
          {MERMAID_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === selectedTemplateId && code.trim() === tmpl.code.trim();
            return (
              <button
                key={tmpl.id}
                type="button"
                className={`import-template-tab ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectTemplate(tmpl)}
              >
                {tmpl.name}
              </button>
            );
          })}
        </div>

        {/* Editor Body */}
        <div className="import-editor-body">
          <div className="import-editor-header">
            <span className="import-editor-lang">Mermaid Flowchart</span>
            <div className="import-editor-actions">
              <button
                type="button"
                className="import-action-btn"
                onClick={handleCopyCode}
                title="Copy diagram code"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="import-action-btn"
                onClick={() => setCode('')}
                title="Clear editor"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            id={editorId}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={11}
            className="import-code-editor"
            placeholder="graph TD&#10;  gateway[API Gateway] --> orders[Order Service]&#10;  orders --> db[(PostgreSQL DB)]"
            spellCheck={false}
            aria-label="Mermaid diagram definition"
          />

          {!parseResult.success && (
            <div className="import-error-banner">
              <span className="import-error-dot" />
              <span>{parseResult.error}</span>
            </div>
          )}
        </div>

        {/* Clean Footer */}
        <div className="import-modal-footer">
          <div className="import-footer-status">
            {parseResult.success ? (
              <span className="import-status-valid">
                <span className="import-status-indicator" />
                {parseResult.nodes.length} nodes · {parseResult.edges.length} edges
              </span>
            ) : (
              <span className="import-status-invalid">Invalid syntax</span>
            )}
          </div>
          <div className="import-footer-buttons">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={!parseResult.success || parseResult.nodes.length === 0}
            >
              Import Diagram
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}