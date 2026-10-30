import { useHealth } from './use-health';

export function SystemStatus() {
  const { state, refresh } = useHealth();

  return (
    <section aria-labelledby="system-status-heading" className="system-status-hud">
      <h2 id="system-status-heading" className="sr-only">
        Server status
      </h2>
      <div
        role="status"
        aria-live="polite"
        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
      >
        {state.phase === 'loading' && (
          <div className="status-chip">
            <span className="status-chip-dot dot-loading" aria-hidden="true" />
            <span className="status-chip-label">ENGINE:</span>
            <span className="status-chip-value">CHECKING...</span>
          </div>
        )}

        {state.phase === 'failed' && (
          <div className="status-chip" style={{ borderColor: 'rgba(244, 63, 94, 0.4)' }}>
            <span className="status-chip-dot dot-error" aria-hidden="true" />
            <span className="status-chip-label">STATUS:</span>
            <span className="status-chip-value" style={{ color: '#f87171' }}>
              OFFLINE
            </span>
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            <div className="status-chip">
              <span className="status-chip-dot dot-ready" aria-hidden="true" />
              <span className="status-chip-label">CONTROL PLANE:</span>
              <span className="status-chip-value" style={{ color: '#34d399' }}>
                {state.health.status.toUpperCase()}
              </span>
            </div>

            <div className="status-chip">
              <span
                className="status-chip-dot dot-ready"
                style={{ background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }}
                aria-hidden="true"
              />
              <span className="status-chip-label">SQLITE WAL:</span>
              <span className="status-chip-value" style={{ color: '#38bdf8' }}>
                {state.health.checks.database.toUpperCase()}
              </span>
            </div>

            <div className="status-chip">
              <span className="status-chip-label">RUNTIME:</span>
              <span className="status-chip-value">{state.health.nodeVersion}</span>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="btn-refresh-pulse"
        onClick={refresh}
        title="Refresh Server Telemetry"
        aria-label="Refresh Server Telemetry"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          stroke="currentColor"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      </button>
    </section>
  );
}
