import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type { TopologyProblem, NodeId } from '@chaosboard/contracts';
import { resolveNodeNumber } from './ValidationBanner';

export interface PreflightBlockerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly problems: readonly TopologyProblem[];
  readonly nodes?: readonly { id: string; label?: string }[];
  readonly onSelectNode?: (id: NodeId) => void;
  readonly onAutoFixEntry?: () => void;
}

export function PreflightBlockerModal({
  isOpen,
  onClose,
  problems,
  nodes,
  onSelectNode,
  onAutoFixEntry,
}: PreflightBlockerModalProps) {
  if (!isOpen) return null;

  const hasMissingNodes = !nodes || nodes.length === 0;
  const isSingleNode = nodes?.length === 1;

  return (
    <Modal
      title="Architecture Validation Blocked"
      isOpen={isOpen}
      onClose={onClose}
      actions={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          {onAutoFixEntry && problems.some((p) => p.code === 'unknown_entry_node') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onAutoFixEntry();
                onClose();
              }}
            >
              Set First Node as Ingress
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.22)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <h4
              style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 600, color: '#f87171' }}
            >
              Simulation Cannot Dispatch
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: '12.5px',
                color: 'var(--color-text-dim)',
                lineHeight: 1.5,
              }}
            >
              {hasMissingNodes
                ? 'Canvas is empty. Resilience simulation requires at least one ingress service and downstream connection.'
                : isSingleNode
                  ? 'A standalone single node cannot be tested for resilience degradation. Connect services or designate ingress.'
                  : `Resolve the following ${String(problems.length)} architecture constraint(s) to run the simulation:`}
            </p>
          </div>
        </div>

        {problems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Validation Issues ({problems.length})
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {problems.map((p, idx) => {
                const nodeNum = p.nodeId ? resolveNodeNumber(p.nodeId, nodes) : null;
                const nodeLabel = nodes?.find((n) => n.id === p.nodeId)?.label;

                return (
                  <div
                    key={`${p.code}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#f43f5e',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text)' }}>
                        {p.message}
                      </span>
                    </div>

                    {p.nodeId && onSelectNode && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNode(p.nodeId as NodeId);
                          onClose();
                        }}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Inspect {nodeLabel ? nodeLabel : `Node ${nodeNum ?? ''}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
