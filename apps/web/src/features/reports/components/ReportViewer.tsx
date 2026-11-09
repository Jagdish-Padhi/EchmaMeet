import { useState, useEffect } from 'react';
import type { ApiClient } from '../../../api/client';
import type { RunId, ReportExport, BlueprintCard } from '@chaosboard/contracts';
import { DrawerLoadingBar } from '../../../components/ui/DrawerLoadingBar';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Alert } from '../../../components/ui/Alert';

export interface ReportViewerProps {
  api: ApiClient;
  runId: RunId;
  hideTitle?: boolean;
}

export function ReportViewer({ api, runId, hideTitle = false }: ReportViewerProps) {
  const [data, setData] = useState<{
    runId: RunId;
    report: ReportExport | null;
    card: BlueprintCard | null;
    loading: boolean;
    error: string | null;
  }>({
    runId,
    report: null,
    card: null,
    loading: true,
    error: null,
  });

  const [activeView, setActiveView] = useState<'summary' | 'markdown' | 'diagram'>('summary');

  useEffect(() => {
    let cancelled = false;

    void Promise.all([api.getReportJson(runId), api.getBlueprintCard(runId)])
      .then(([reportData, cardData]) => {
        if (!cancelled) {
          setData({
            runId,
            report: reportData,
            card: cardData,
            loading: false,
            error: null,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData({
            runId,
            report: null,
            card: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load report data',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, runId]);

  const report = data.runId === runId ? data.report : null;
  const card = data.runId === runId ? data.card : null;
  const loading = data.runId !== runId || data.loading;
  const error = data.runId === runId ? data.error : null;

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${runId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    if (!report?.diagramSvg) return;
    const blob = new Blob([report.diagramSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topology-${runId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="reports-viewer-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!hideTitle && (
          <div className="run-audit-section-title">Run Report &amp; Artifact Export</div>
        )}
        <DrawerLoadingBar
          label={`Loading report data for run:${runId.slice(0, 8)}...`}
        />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="reports-viewer-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!hideTitle && (
          <div className="run-audit-section-title">Run Report &amp; Artifact Export</div>
        )}
        <Alert variant="error" title="Report Unavailable">
          {error ?? 'Unable to retrieve architecture report for this execution.'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="reports-viewer-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!hideTitle && (
        <div className="run-audit-section-title">Run Report &amp; Artifact Export</div>
      )}
      {/* Action & Navigation Bar */}
      <div className="reports-action-bar">
        <div className="reports-nav-group">
          <button
            type="button"
            className={`reports-nav-btn ${activeView === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveView('summary')}
          >
            Summary &amp; Card
          </button>
          <button
            type="button"
            className={`reports-nav-btn ${activeView === 'diagram' ? 'active' : ''}`}
            onClick={() => setActiveView('diagram')}
          >
            Topology SVG
          </button>
          <button
            type="button"
            className={`reports-nav-btn ${activeView === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveView('markdown')}
          >
            Markdown
          </button>
        </div>

        <div className="reports-download-group">
          <button
            type="button"
            className="reports-download-btn"
            onClick={handleDownloadMarkdown}
            title="Download Markdown Report"
          >
            .md
          </button>
          <button
            type="button"
            className="reports-download-btn"
            onClick={handleDownloadJson}
            title="Download JSON Export"
          >
            .json
          </button>
          {report.diagramSvg && (
            <button
              type="button"
              className="reports-download-btn"
              onClick={handleDownloadSvg}
              title="Download Topology SVG"
            >
              .svg
            </button>
          )}
        </div>
      </div>

      {/* Provenance Metadata Badge Strip */}
      <div className="meta-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
        <span className="meta-pill">
          <span className="meta-pill-label">Run</span>
          <span className="cell-mono">run:{runId.slice(0, 8)}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Commit</span>
          <span className="cell-mono">{report.provenance.gitCommit.slice(0, 7)}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Host</span>
          <span>{report.provenance.hostDescription.split(' ')[0]}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Node</span>
          <span className="cell-mono">{report.provenance.nodeVersion}</span>
        </span>
      </div>

      {activeView === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Authoritative Empirical Verdicts */}
          <div className="report-verdicts-section">
            <div className="run-audit-section-title" style={{ marginBottom: 8 }}>
              Authoritative Empirical Verdicts
            </div>
            {report.verdicts.length === 0 ? (
              <p className="state-message" style={{ margin: 0 }}>
                No invariant verdicts recorded for this run.
              </p>
            ) : (
              <div className="verdicts-vertical-list">
                {report.verdicts.map((v) => (
                  <div
                    key={v.invariantId}
                    className={`verdict-vertical-card verdict-${v.status.toLowerCase()}`}
                  >
                    <div className="verdict-card-header">
                      <div className="verdict-card-id-group">
                        <span className="verdict-indicator-dot" />
                        <span className="cell-mono verdict-id-cell">{v.invariantId}</span>
                      </div>
                      <StatusPill status={v.status} />
                    </div>
                    <div className="verdict-card-reason" style={{ marginTop: 6 }}>
                      <span className="verdict-field-label">Evidence</span>
                      <p className="verdict-reason-text">
                        {v.reason ??
                          `${v.evidence.metric} ${v.evidence.comparator} ${String(v.evidence.threshold)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faulted Distribution Medians */}
          <div className="report-medians-section">
            <div className="run-audit-section-title" style={{ marginBottom: 8 }}>
              Empirical Performance Metrics
            </div>
            <div className="summary-grid">
              <div className="summary-metric-box">
                <span className="summary-label">p50 Latency</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.p50Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p50Ms)}ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">p99 Latency</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.p99Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p99Ms)}ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">Error Rate</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.errorRate !== undefined
                    ? `${String(Math.round(card.authoritativeMetrics.errorRate * 100))}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">Run Status</span>
                <span
                  className="summary-value"
                  style={{
                    textTransform: 'capitalize',
                    color:
                      report.status === 'completed'
                        ? 'var(--color-success, #22c55e)'
                        : 'var(--color-text)',
                  }}
                >
                  {report.status}
                </span>
              </div>
            </div>
          </div>

          {/* Blueprint Card / Illustrative Rendering */}
          <div className="report-blueprint-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div className="run-audit-section-title" style={{ margin: 0 }}>
                Topology Vector Blueprint
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-dim)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Vector Blueprint
              </span>
            </div>

            {card?.fallbackReason && (
              <div
                style={{
                  background: 'rgba(234, 88, 12, 0.12)',
                  color: '#fb923c',
                  border: '1px solid rgba(234, 88, 12, 0.3)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                <strong>Degraded: </strong>
                {card.fallbackReason}
              </div>
            )}

            <div
              style={{
                minHeight: 180,
                background: 'var(--color-bg)',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-border)',
                padding: 10,
              }}
            >
              {card?.mimeType === 'image/svg+xml' ? (
                <div
                  style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: card.content }}
                />
              ) : card?.content ? (
                <img
                  src={card.content}
                  alt="System Blueprint Card"
                  style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }}
                />
              ) : (
                <p className="state-message" style={{ margin: 0 }}>
                  No diagram available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'diagram' && (
        <div
          style={{
            background: 'var(--color-bg)',
            padding: 14,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            overflow: 'auto',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: report.diagramSvg }} />
        </div>
      )}

      {activeView === 'markdown' && (
        <div
          style={{
            background: 'var(--color-bg)',
            padding: 14,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            overflow: 'auto',
            maxHeight: 500,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {report.markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
