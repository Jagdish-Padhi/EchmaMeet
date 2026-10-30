import {
  catalog,
  type EdgePolicy,
  type FallbackMode,
  type TopologyEdge,
} from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface EdgeInspectorProps {
  readonly edge: TopologyEdge | null;
  readonly onUpdatePolicy: (policy: EdgePolicy) => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

export function EdgeInspector({ edge, onUpdatePolicy, onDelete, onClose }: EdgeInspectorProps) {
  if (!edge) return null;

  const { edge: edgeBounds } = catalog;
  const policy = edge.policy;

  const handleTimeoutChange = (enabled: boolean, msVal: number) => {
    onUpdatePolicy({
      ...policy,
      timeoutMs: enabled ? msVal : null,
    });
  };

  const handleRetryAttemptsChange = (attempts: number) => {
    onUpdatePolicy({
      ...policy,
      retry: {
        ...policy.retry,
        maxAttempts: attempts,
      },
    });
  };

  const handleRetryBackoffChange = (baseMs: number) => {
    onUpdatePolicy({
      ...policy,
      retry: {
        ...policy.retry,
        backoffBaseMs: baseMs,
      },
    });
  };

  const handleBreakerToggle = (enabled: boolean) => {
    onUpdatePolicy({
      ...policy,
      breaker: {
        ...policy.breaker,
        enabled,
      },
    });
  };

  const handleFallbackChange = (fallback: FallbackMode) => {
    onUpdatePolicy({
      ...policy,
      fallback,
    });
  };

  return (
    <Card
      title={`Edge: ${edge.source} -> ${edge.target}`}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      }
      className="inspector-card"
    >
      <div className="inspector-fields">
        {/* Timeout */}
        <div className="field-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={policy.timeoutMs !== null}
              onChange={(e) => handleTimeoutChange(e.target.checked, policy.timeoutMs ?? 1000)}
            />
            <span className="field-label">Enable Explicit Timeout</span>
          </label>
          {policy.timeoutMs !== null && (
            <input
              type="number"
              className="input-number"
              min={edgeBounds.timeoutMs.min}
              max={edgeBounds.timeoutMs.max}
              value={policy.timeoutMs}
              onChange={(e) => handleTimeoutChange(true, parseInt(e.target.value, 10) || 500)}
            />
          )}
        </div>

        {/* Retries */}
        <div className="field-group">
          <span className="field-label">Retry Attempts</span>
          <input
            type="number"
            className="input-number"
            min={edgeBounds.maxAttempts.min}
            max={edgeBounds.maxAttempts.max}
            value={policy.retry.maxAttempts}
            onChange={(e) => handleRetryAttemptsChange(parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <div className="field-group">
          <span className="field-label">Retry Backoff Base (ms)</span>
          <input
            type="number"
            className="input-number"
            min={edgeBounds.backoffBaseMs.min}
            max={edgeBounds.backoffBaseMs.max}
            value={policy.retry.backoffBaseMs}
            onChange={(e) => handleRetryBackoffChange(parseInt(e.target.value, 10) || 10)}
          />
        </div>

        {/* Circuit Breaker */}
        <div className="field-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={policy.breaker.enabled}
              onChange={(e) => handleBreakerToggle(e.target.checked)}
            />
            <span className="field-label">Circuit Breaker Enabled</span>
          </label>
        </div>

        {/* Fallback Mode */}
        <div className="field-group">
          <span className="field-label">Fallback Policy</span>
          <select
            className="input-select"
            value={policy.fallback}
            onChange={(e) => handleFallbackChange(e.target.value as FallbackMode)}
          >
            <option value="fail_fast_503">Fail Fast (HTTP 503)</option>
            <option value="serve_stale_cache">Serve Stale Cache</option>
            <option value="enqueue_for_later">Enqueue for Later</option>
          </select>
        </div>

        <div className="inspector-actions">
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete Edge
          </Button>
        </div>
      </div>
    </Card>
  );
}
