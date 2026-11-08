import { useState } from 'react';
import type { BoardState } from '../../board';
import type { AppSettings } from '../../settings';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface SimulationDiagnosticsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly errorMessage: string | null;
  readonly runId: string | null;
  readonly board: BoardState;
  readonly settings: AppSettings;
  readonly onOpenSettings?: (() => void) | undefined;
  readonly onForceResetLock?: (() => Promise<void> | void) | undefined;
  readonly onRetrySimulation?: (() => void) | undefined;
  readonly onAutoRemediate?: (() => Promise<unknown> | void) | undefined;
}

export function SimulationDiagnosticsModal({
  isOpen,
  onClose,
  status,
  errorMessage,
  runId,
  board,
  settings,
  onOpenSettings,
  onForceResetLock,
  onRetrySimulation,
  onAutoRemediate,
}: SimulationDiagnosticsModalProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  if (!isOpen) return null;

  const rawMsg = errorMessage ?? '';
  const isBusy =
    status === 'busy' ||
    rawMsg.toLowerCase().includes('busy') ||
    rawMsg.toLowerCase().includes('host lock');
  const isAuthError =
    rawMsg.toLowerCase().includes('unauthorized') ||
    rawMsg.toLowerCase().includes('authentication') ||
    rawMsg.toLowerCase().includes('401');
  const isApiKeyIssue =
    rawMsg.toLowerCase().includes('api key') ||
    rawMsg.toLowerCase().includes('gnani') ||
    rawMsg.toLowerCase().includes('evon') ||
    rawMsg.toLowerCase().includes('model');
  const isTopologyIssue =
    board.nodes.length === 0 ||
    board.validationProblems.length > 0 ||
    rawMsg.toLowerCase().includes('topology') ||
    rawMsg.toLowerCase().includes('preflight') ||
    rawMsg.toLowerCase().includes('consumer_requires_async_edge') ||
    rawMsg.toLowerCase().includes('validation failed') ||
    rawMsg.toLowerCase().includes('empty canvas');
  const isToxiproxyIssue =
    rawMsg.toLowerCase().includes('toxiproxy') ||
    rawMsg.toLowerCase().includes('8474') ||
    rawMsg.toLowerCase().includes('proxy');

  const titleBadge = isBusy
    ? 'Host Lock Conflict'
    : isAuthError
      ? 'Authentication Required'
      : isApiKeyIssue
        ? 'AI / Model Key Notice'
        : isTopologyIssue
          ? 'Architecture Validation'
          : isToxiproxyIssue
            ? 'Chaos Engine Communication'
            : 'Simulation Diagnostic Alert';

  const handleResetLock = async () => {
    setIsResetting(true);
    try {
      if (onForceResetLock) {
        await onForceResetLock();
      }
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        onClose();
      }, 1200);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Modal
      title="Resilience Simulation Diagnostics"
      isOpen={isOpen}
      onClose={onClose}
      actions={
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            width: '100%',
            alignItems: 'center',
          }}
        >
          {isBusy && onForceResetLock && (
            <Button
              variant="danger"
              size="sm"
              disabled={isResetting}
              onClick={() => void handleResetLock()}
            >
              {isResetting
                ? 'Resetting Host...'
                : resetSuccess
                  ? 'Lock Released'
                  : 'Force Release Host Lock'}
            </Button>
          )}

          {onOpenSettings && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
            >
              Open API & Provider Settings
            </Button>
          )}

          {isTopologyIssue && onAutoRemediate && (
            <Button
              variant="primary"
              size="sm"
              disabled={isFixing || isResetting}
              onClick={async () => {
                setIsFixing(true);
                try {
                  const res = await onAutoRemediate();
                  if (res !== false) {
                    onClose();
                    if (onRetrySimulation) {
                      onRetrySimulation();
                    }
                  }
                } finally {
                  setIsFixing(false);
                }
              }}
              style={{
                background: '#0284c7',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {isFixing ? 'Auto-Fixing...' : 'Auto-Fix Architecture & Retry'}
            </Button>
          )}

          {onRetrySimulation && (
            <Button
              variant={isTopologyIssue && onAutoRemediate ? 'secondary' : 'primary'}
              size="sm"
              disabled={isResetting || isFixing || board.nodes.length === 0}
              onClick={() => {
                onClose();
                onRetrySimulation();
              }}
            >
              Retry Simulation
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Banner with Diagnosis */}
        <div
          className={`simulation-diag-banner ${isBusy ? 'is-busy' : 'is-error'}`}
        >
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            {isBusy ? (
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className={`diag-badge ${isBusy ? 'is-busy' : 'is-error'}`}>
                {titleBadge}
              </span>
              {runId && (
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  ID: {runId.slice(0, 12)}
                </span>
              )}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--color-text)',
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              {isBusy
                ? 'The simulation host lock is currently engaged by a running or recently finished trial. In multi-process architectures, mutual exclusion locks prevent port collisions and contaminated tail telemetry.'
                : rawMsg ||
                  'Execution encountered an operational error during simulation initialization.'}
            </p>
          </div>
        </div>

        {/* Enterprise System Diagnostics Matrix */}
        <div>
          <h4
            style={{
              margin: '0 0 8px 0',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
            }}
          >
            System & Prerequisite Matrix
          </h4>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'var(--color-bg-alt)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '12px 14px',
            }}
          >
            {/* 1. Canvas Architecture */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Architecture Topology</span>
                <span
                  style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}
                >
                  {board.nodes.length} node(s), {board.edges.length} edge(s)
                  {board.validationProblems.length > 0
                    ? ` (${board.validationProblems.length} issue(s))`
                    : ' (Valid structure)'}
                </span>
              </div>
              <StatusPill
                status={
                  board.nodes.length > 0 && board.validationProblems.length === 0
                    ? 'PASS'
                    : 'VIOLATED'
                }
              />
            </div>

            <div style={{ height: '1px', background: 'var(--color-border)', opacity: 0.5 }} />

            {/* 2. AI Model & API Key Configuration */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Voice &amp; Repair Engine</span>
                <span
                  style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}
                >
                  Gnani Prisma + Timbre for speech; rule engine and ML diagnosis for repair
                  (language: {settings.voiceLanguage})
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                }}
              >
                OPTIONAL FOR RUN
              </span>
            </div>

            <div style={{ height: '1px', background: 'var(--color-border)', opacity: 0.5 }} />

            {/* 3. Chaos Toxiproxy Engine */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Toxiproxy Fault Injection Engine</span>
                <span
                  style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}
                >
                  Local / Container proxy daemon on port 8474
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isToxiproxyIssue
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                  color: isToxiproxyIssue ? '#f87171' : '#10b981',
                }}
              >
                {isToxiproxyIssue ? 'UNREACHABLE' : 'ONLINE'}
              </span>
            </div>

            <div style={{ height: '1px', background: 'var(--color-border)', opacity: 0.5 }} />

            {/* 4. Host Single-Tenant Execution Lock */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Host Process Isolation Lock</span>
                <span
                  style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}
                >
                  {isBusy
                    ? 'Busy: Lock currently claimed by another process'
                    : 'Free: Ready to execute'}
                </span>
              </div>
              <StatusPill status={isBusy ? 'busy' : 'idle'} />
            </div>
          </div>
        </div>

        {/* Actionable Enterprise Recommendations */}
        <div
          style={{
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Recommended Next Steps
          </span>
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              fontSize: '13px',
              color: 'var(--color-text-dim)',
              lineHeight: 1.6,
            }}
          >
            {isBusy && (
              <li>
                Click <strong>Force Release Host Lock</strong> to immediately terminate any stalled
                background child processes and clear the reservation.
              </li>
            )}
            {board.nodes.length === 0 && (
              <li>Add at least one service from the top toolbar to the canvas.</li>
            )}
            {board.validationProblems.length > 0 && (
              <li>
                Resolve the architecture validation issue(s) highlighted on the canvas before
                re-running.
              </li>
            )}
            <li>
              If you plan to run <strong>Autonomous AI Repair</strong> or ask{' '}
              <strong>SRE Copilot</strong> questions, set <code>GNANI_API_KEY</code> for voice and
              optionally <code>EVON_BASE_URL</code> in the server <code>.env</code>.
            </li>
            {isToxiproxyIssue && (
              <li>
                Ensure Docker or the Toxiproxy daemon is listening on port <code>8474</code> (run{' '}
                <code>docker compose up -d</code>).
              </li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
