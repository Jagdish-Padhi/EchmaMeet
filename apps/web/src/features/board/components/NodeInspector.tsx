import { catalog, type TopologyNode } from '@chaosboard/contracts';
import type { BoardNode } from '../types';

export interface NodeInspectorProps {
  readonly node: BoardNode | null;
  readonly onUpdate: (patch: Partial<TopologyNode>) => void;
  readonly onDelete?: () => void;
  readonly onDuplicate?: () => void;
}

export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
  if (!node) return null;

  const { node: nodeBounds } = catalog;
  const isLognormal = node.processing.distribution === 'lognormal';
  const processingMs =
    node.processing.distribution === 'constant' ? node.processing.ms : node.processing.medianMs;
  const sigmaValue = node.processing.distribution === 'lognormal' ? node.processing.sigma : 0.4;

  return (
    <div className="inspector-panel">
      <div className="inspector-content-stack">
        {/* Service Label */}
        <div className="control-field">
          <label className="control-label" htmlFor="node-label-input">
            Service Label
          </label>
          <input
            id="node-label-input"
            type="text"
            className="control-input-text"
            value={node.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>

        {/* Component Kind */}
        <div className="control-field">
          <label className="control-label" htmlFor="node-kind-select">
            Architecture Role
          </label>
          <select
            id="node-kind-select"
            className="control-select"
            value={node.kind}
            onChange={(e) => {
              const kind = e.target.value;
              if (kind === 'cache') {
                onUpdate({ kind: 'cache', ttlMs: 60000 });
              } else if (kind === 'queue_consumer') {
                onUpdate({ kind: 'queue_consumer', consumeRateRps: 50 });
              } else if (kind === 'ledger_sink') {
                onUpdate({ kind: 'ledger_sink', dedupeByKey: true });
              } else {
                onUpdate({ kind: 'service' });
              }
            }}
          >
            <option value="service">Stateless Service</option>
            <option value="cache">In-Memory Cache</option>
            <option value="queue_consumer">Queue Consumer</option>
            <option value="ledger_sink">Ledger Sink (Stateful)</option>
          </select>
        </div>

        {/* Concurrency Limit */}
        <div className="control-field">
          <div className="control-label-row">
            <label className="control-label" htmlFor="node-workers-input">
              Max Concurrency (Workers)
            </label>
            <span className="control-value-badge">{node.concurrency.maxWorkers} workers</span>
          </div>
          <div className="control-slider-input-group">
            <input
              type="range"
              className="control-slider"
              min={nodeBounds.maxWorkers.min}
              max={nodeBounds.maxWorkers.max}
              value={node.concurrency.maxWorkers}
              onChange={(e) =>
                onUpdate({
                  concurrency: { maxWorkers: parseInt(e.target.value, 10) || 1 },
                })
              }
            />
            <input
              id="node-workers-input"
              type="number"
              className="control-input-number"
              min={nodeBounds.maxWorkers.min}
              max={nodeBounds.maxWorkers.max}
              value={node.concurrency.maxWorkers}
              onChange={(e) =>
                onUpdate({
                  concurrency: { maxWorkers: parseInt(e.target.value, 10) || 1 },
                })
              }
            />
          </div>
        </div>

        {/* Execution Latency Profile */}
        <div className="control-field">
          <div className="control-label-row">
            <span className="control-label">Latency Distribution</span>
            <div className="segmented-toggle">
              <button
                type="button"
                className={`toggle-option ${!isLognormal ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    processing: { distribution: 'constant', ms: processingMs },
                  })
                }
              >
                Constant
              </button>
              <button
                type="button"
                className={`toggle-option ${isLognormal ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    processing: {
                      distribution: 'lognormal',
                      medianMs: processingMs,
                      sigma: sigmaValue,
                    },
                  })
                }
              >
                Lognormal
              </button>
            </div>
          </div>

          <div className="control-slider-input-group">
            <input
              type="range"
              className="control-slider"
              min={nodeBounds.processingMs.min}
              max={Math.min(2000, nodeBounds.processingMs.max)}
              step={5}
              value={processingMs}
              onChange={(e) => {
                const ms = parseInt(e.target.value, 10) || 0;
                if (isLognormal) {
                  onUpdate({
                    processing: {
                      distribution: 'lognormal',
                      medianMs: ms,
                      sigma: sigmaValue,
                    },
                  });
                } else {
                  onUpdate({ processing: { distribution: 'constant', ms } });
                }
              }}
            />
            <div className="number-unit-wrapper">
              <input
                type="number"
                className="control-input-number"
                min={nodeBounds.processingMs.min}
                max={nodeBounds.processingMs.max}
                value={processingMs}
                onChange={(e) => {
                  const ms = parseInt(e.target.value, 10) || 0;
                  if (isLognormal) {
                    onUpdate({
                      processing: {
                        distribution: 'lognormal',
                        medianMs: ms,
                        sigma: sigmaValue,
                      },
                    });
                  } else {
                    onUpdate({ processing: { distribution: 'constant', ms } });
                  }
                }}
              />
              <span className="unit-tag">ms</span>
            </div>
          </div>

          {isLognormal && (
            <div className="nested-field">
              <div className="control-label-row">
                <span className="control-sublabel">Tail Dispersion (&sigma;)</span>
                <span className="control-value-badge">{sigmaValue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="control-slider"
                min={nodeBounds.lognormalSigma.min}
                max={nodeBounds.lognormalSigma.max}
                step={0.05}
                value={sigmaValue}
                onChange={(e) => {
                  const sigma = parseFloat(e.target.value) || 0.1;
                  onUpdate({
                    processing: {
                      distribution: 'lognormal',
                      medianMs: processingMs,
                      sigma,
                    },
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* Queue & Backpressure Mode */}
        <div className="control-field">
          <div className="control-label-row">
            <span className="control-label">Queue Buffering</span>
            <div className="segmented-toggle">
              <button
                type="button"
                className={`toggle-option ${node.queue.mode === 'bounded' ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    queue: { mode: 'bounded', maxDepth: 50 },
                  })
                }
              >
                Bounded
              </button>
              <button
                type="button"
                className={`toggle-option ${node.queue.mode === 'unbounded' ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    queue: { mode: 'unbounded' },
                  })
                }
              >
                Unbounded
              </button>
            </div>
          </div>

          {node.queue.mode === 'bounded' && (
            <div className="control-slider-input-group">
              <input
                type="range"
                className="control-slider"
                min={nodeBounds.queueDepth.min}
                max={2000}
                step={10}
                value={node.queue.maxDepth}
                onChange={(e) =>
                  onUpdate({
                    queue: {
                      mode: 'bounded',
                      maxDepth: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
              />
              <div className="number-unit-wrapper">
                <input
                  type="number"
                  className="control-input-number"
                  min={nodeBounds.queueDepth.min}
                  max={nodeBounds.queueDepth.max}
                  value={node.queue.maxDepth}
                  onChange={(e) =>
                    onUpdate({
                      queue: {
                        mode: 'bounded',
                        maxDepth: parseInt(e.target.value, 10) || 1,
                      },
                    })
                  }
                />
                <span className="unit-tag">items</span>
              </div>
            </div>
          )}
        </div>

        {/* Ingress Rate Limiting */}
        <div className="control-field">
          <div className="control-label-row">
            <label className="checkbox-label" htmlFor="ingress-rate-toggle">
              <input
                id="ingress-rate-toggle"
                type="checkbox"
                checked={node.ingressRateLimitRps !== null}
                onChange={(e) =>
                  onUpdate({
                    ingressRateLimitRps: e.target.checked ? 500 : null,
                  })
                }
              />
              <span className="control-label">Ingress Rate Limit</span>
            </label>
            {node.ingressRateLimitRps !== null && (
              <span className="control-value-badge">{node.ingressRateLimitRps} RPS</span>
            )}
          </div>

          {node.ingressRateLimitRps !== null && (
            <div className="control-slider-input-group">
              <input
                type="range"
                className="control-slider"
                min={nodeBounds.ingressRateLimitRps.min}
                max={nodeBounds.ingressRateLimitRps.max}
                step={25}
                value={node.ingressRateLimitRps}
                onChange={(e) =>
                  onUpdate({
                    ingressRateLimitRps: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
              <div className="number-unit-wrapper">
                <input
                  type="number"
                  className="control-input-number"
                  min={nodeBounds.ingressRateLimitRps.min}
                  max={nodeBounds.ingressRateLimitRps.max}
                  value={node.ingressRateLimitRps}
                  onChange={(e) =>
                    onUpdate({
                      ingressRateLimitRps: parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
                <span className="unit-tag">RPS</span>
              </div>
            </div>
          )}
        </div>

        {/* Kind-Specific Configuration */}
        {node.kind === 'cache' && (
          <div className="control-field">
            <div className="control-label-row">
              <label className="control-label" htmlFor="cache-ttl-input">
                Cache TTL
              </label>
              <span className="control-value-badge">{(node.ttlMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="control-slider-input-group">
              <input
                type="range"
                className="control-slider"
                min={nodeBounds.cacheTtlMs.min}
                max={nodeBounds.cacheTtlMs.max}
                step={500}
                value={node.ttlMs}
                onChange={(e) =>
                  onUpdate({
                    ttlMs: parseInt(e.target.value, 10) || 100,
                  })
                }
              />
              <div className="number-unit-wrapper">
                <input
                  id="cache-ttl-input"
                  type="number"
                  className="control-input-number"
                  min={nodeBounds.cacheTtlMs.min}
                  max={nodeBounds.cacheTtlMs.max}
                  value={node.ttlMs}
                  onChange={(e) =>
                    onUpdate({
                      ttlMs: parseInt(e.target.value, 10) || 100,
                    })
                  }
                />
                <span className="unit-tag">ms</span>
              </div>
            </div>
          </div>
        )}

        {node.kind === 'queue_consumer' && (
          <div className="control-field">
            <div className="control-label-row">
              <label className="control-label" htmlFor="consume-rate-input">
                Drain Rate
              </label>
              <span className="control-value-badge">{node.consumeRateRps} RPS</span>
            </div>
            <div className="control-slider-input-group">
              <input
                type="range"
                className="control-slider"
                min={nodeBounds.consumeRateRps.min}
                max={nodeBounds.consumeRateRps.max}
                step={10}
                value={node.consumeRateRps}
                onChange={(e) =>
                  onUpdate({
                    consumeRateRps: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
              <div className="number-unit-wrapper">
                <input
                  id="consume-rate-input"
                  type="number"
                  className="control-input-number"
                  min={nodeBounds.consumeRateRps.min}
                  max={nodeBounds.consumeRateRps.max}
                  value={node.consumeRateRps}
                  onChange={(e) =>
                    onUpdate({
                      consumeRateRps: parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
                <span className="unit-tag">RPS</span>
              </div>
            </div>
          </div>
        )}

        {node.kind === 'ledger_sink' && (
          <div className="control-field">
            <div className="control-label-row">
              <span className="control-label">Idempotency Deduplication</span>
              <div className="segmented-toggle">
                <button
                  type="button"
                  className={`toggle-option ${node.dedupeByKey ? 'active' : ''}`}
                  onClick={() => onUpdate({ dedupeByKey: true })}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  className={`toggle-option ${!node.dedupeByKey ? 'active' : ''}`}
                  onClick={() => onUpdate({ dedupeByKey: false })}
                >
                  Disabled
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
