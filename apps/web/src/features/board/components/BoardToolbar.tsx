import type { NodeKind } from '@chaosboard/contracts';
import type { NodePresetConfig } from '../hooks/use-board-state';

export interface BoardToolbarProps {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly hasSelection: boolean;
  readonly validationProblemCount: number;
  readonly onAddNode: (kind: NodeKind, preset?: NodePresetConfig) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

export function BoardToolbar({
  nodeCount,
  edgeCount,
  hasSelection,
  validationProblemCount,
  onAddNode,
  onDuplicate,
  onDelete,
}: BoardToolbarProps) {
  return (
    <div
      className="studio-architecture-toolbar"
      role="toolbar"
      aria-label="Architecture Components and Canvas Actions"
    >
      {/* Row 1: Comprehensive Distributed Architecture Component Palette */}
      <div className="toolbar-row-palette">
        <span className="toolbar-section-label">Palette</span>

        {/* Compute & Gateways */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-item-btn btn-gateway"
            onClick={() =>
              onAddNode('service', { label: 'API Gateway', processingMs: 5, maxWorkers: 20 })
            }
            title="Add ingress API Gateway (Envoy/Kong)"
          >
            <span className="item-icon-dot blue" />
            <span>+ Gateway</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('service', { label: 'Microservice', processingMs: 15, maxWorkers: 15 })
            }
            title="Add standard Microservice (Key: 1)"
          >
            <span className="item-icon-dot blue" />
            <span>+ Service</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('service', { label: 'Auth Service', processingMs: 10, maxWorkers: 10 })
            }
            title="Add Auth / Identity token validator"
          >
            <span className="item-icon-dot blue" />
            <span>+ Auth</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('service', { label: 'Postgres DB', processingMs: 35, maxWorkers: 5 })
            }
            title="Add stateful database store"
          >
            <span className="item-icon-dot blue" />
            <span>+ Database</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('service', { label: 'External API', processingMs: 85, maxWorkers: 5 })
            }
            title="Add third-party external API (Stripe, Twilio)"
          >
            <span className="item-icon-dot amber" />
            <span>+ 3rd-Party API</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Caching Layers */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('cache', {
                label: 'Redis Cache',
                processingMs: 2,
                maxWorkers: 25,
                ttlMs: 60000,
              })
            }
            title="Add in-memory Redis cache (Key: 2)"
          >
            <span className="item-icon-dot yellow" />
            <span>+ Redis Cache</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('cache', {
                label: 'CDN Edge',
                processingMs: 1,
                maxWorkers: 50,
                ttlMs: 300000,
              })
            }
            title="Add Cloudflare/Fastly CDN Edge Cache"
          >
            <span className="item-icon-dot yellow" />
            <span>+ CDN Edge</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Queues & Streaming */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('queue_consumer', {
                label: 'Queue Worker',
                processingMs: 25,
                maxWorkers: 15,
                consumeRateRps: 50,
              })
            }
            title="Add BullMQ / SQS queue worker (Key: 3)"
          >
            <span className="item-icon-dot cyan" />
            <span>+ Queue Worker</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('queue_consumer', {
                label: 'Kafka Stream',
                processingMs: 10,
                maxWorkers: 30,
                consumeRateRps: 100,
              })
            }
            title="Add high-throughput Kafka streaming consumer"
          >
            <span className="item-icon-dot cyan" />
            <span>+ Kafka Stream</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Ledgers & Sinks */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('ledger_sink', {
                label: 'Financial Ledger',
                processingMs: 50,
                maxWorkers: 5,
                dedupeByKey: true,
              })
            }
            title="Add idempotent ledger deduplication sink (Key: 4)"
          >
            <span className="item-icon-dot green" />
            <span>+ Ledger Sink</span>
          </button>

          <button
            type="button"
            className="toolbar-item-btn"
            onClick={() =>
              onAddNode('ledger_sink', {
                label: 'Object Store',
                processingMs: 35,
                maxWorkers: 10,
                dedupeByKey: false,
              })
            }
            title="Add S3 / GCS object storage sink"
          >
            <span className="item-icon-dot green" />
            <span>+ Object Store</span>
          </button>
        </div>
      </div>

      {/* Row 2: Canvas Canvas Controls & Topology Metrics */}
      <div className="toolbar-row-actions">
        <div className="toolbar-actions-left">
          <button
            type="button"
            className="toolbar-action-tool"
            disabled={!hasSelection}
            onClick={onDuplicate}
            title="Duplicate selected node (Ctrl+D)"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            className="toolbar-action-tool danger"
            disabled={!hasSelection}
            onClick={onDelete}
            title="Delete selected element (Del / Backspace)"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>

          <span className="toolbar-hint-chip">
            Drag port on right edge of any card to link downstream service
          </span>
        </div>

        <div className="toolbar-actions-right">
          <span className="toolbar-stats-chip">
            Nodes: {nodeCount} &bull; Links: {edgeCount}
          </span>

          {validationProblemCount === 0 ? (
            <span
              className="toolbar-status-badge valid"
              title="Topology satisfies all distributed invariants"
            >
              <span className="status-dot green" />
              <span>Valid Mesh</span>
            </span>
          ) : (
            <span className="toolbar-status-badge warning" title="Topology has validation warnings">
              <span className="status-dot amber" />
              <span>{validationProblemCount} Issues</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
