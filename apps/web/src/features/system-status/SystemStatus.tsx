import { useHealth } from './use-health';

export function SystemStatus() {
  const { state, refresh } = useHealth();

  return (
    <section aria-labelledby="system-status-heading" className="panel">
      <h2 id="system-status-heading">Server status</h2>
      <div role="status" aria-live="polite">
        {state.phase === 'loading' && <p>Checking the server.</p>}
        {state.phase === 'failed' && (
          <p className="problem">Could not read server status. {state.message}</p>
        )}
        {state.phase === 'ready' && (
          <dl className="facts">
            <dt>Status</dt>
            <dd className="mono">{state.health.status.toUpperCase()}</dd>
            <dt>Database</dt>
            <dd className="mono">{state.health.checks.database.toUpperCase()}</dd>
            <dt>Node.js</dt>
            <dd className="mono">{state.health.nodeVersion}</dd>
          </dl>
        )}
      </div>
      <button type="button" onClick={refresh}>
        Check again
      </button>
    </section>
  );
}
