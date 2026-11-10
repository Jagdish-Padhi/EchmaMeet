import { useState, useEffect } from 'react';
import type { ApiClient } from '../../../api/client';
import type { RunId, ReportExport, BlueprintCard } from '@chaosboard/contracts';
import { DrawerLoadingBar } from '../../../components/ui/DrawerLoadingBar';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Alert } from '../../../components/ui/Alert';
import { formatEmpiricalFinding } from '../../experiments/utils/verdictFormatters';

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

  const [activeView, setActiveView] = useState<'summary' | 'markdown'>('summary');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

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

  const handleCopyMarkdown = async () => {
    if (!report?.markdown) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // Fallback
    }
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
            Executive Report
          </button>
          <button
            type="button"
            className={`reports-nav-btn ${activeView === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveView('markdown')}
          >
            Architecture ADR
          </button>
        </div>

        <div className="reports-download-group">
          <button
            type="button"
            className="reports-download-btn"
            onClick={handleDownloadMarkdown}
            title="Export Markdown Architectural Decision Record"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>ADR (.md)</span>
          </button>
          <button
            type="button"
            className="reports-download-btn"
            onClick={handleDownloadJson}
            title="Export Telemetry JSON"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Data (.json)</span>
          </button>
          {report.diagramSvg && (
            <button
              type="button"
              className="reports-download-btn"
              onClick={handleDownloadSvg}
              title="Export Vector Architecture Diagram"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Diagram (.svg)</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Provenance Metadata Strip */}
      <div className="meta-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className="meta-pill">
          <span className="meta-pill-label">Run</span>
          <span className="cell-mono">{runId.slice(0, 8)}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Topology</span>
          <span>{report.topology.name}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Commit</span>
          <span className="cell-mono">{report.provenance.gitCommit.slice(0, 7)}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Status</span>
          <span style={{ textTransform: 'capitalize', fontWeight: 600, color: report.status === 'completed' ? 'var(--color-success, #22c55e)' : 'var(--color-text)' }}>
            {report.status}
          </span>
        </span>
      </div>

      {activeView === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section 1: Invariant SLO Verdicts */}
          <div className="report-verdicts-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="run-audit-section-title" style={{ margin: 0 }}>
                SLO Invariant Verdicts
              </div>
              <span className="reports-count-badge">
                {report.verdicts.length} Invariant{report.verdicts.length === 1 ? '' : 's'} Evaluated
              </span>
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

                    <div className="verdict-card-grid">
                      <div className="verdict-card-field">
                        <span className="verdict-field-label">Metric</span>
                        <span className="verdict-field-value cell-mono">{v.evidence.metric}</span>
                      </div>
                      <div className="verdict-card-field">
                        <span className="verdict-field-label">Threshold</span>
                        <span className="verdict-field-value cell-mono">
                          {v.evidence.comparator} {String(v.evidence.threshold)}
                        </span>
                      </div>
                      <div className="verdict-card-field">
                        <span className="verdict-field-label">Faulted Median</span>
                        <span className="verdict-field-value cell-mono">
                          {v.evidence.faultedAggregate && v.evidence.faultedAggregate.median !== null
                            ? `${v.evidence.faultedAggregate.median.toFixed(1)}${
                                v.evidence.faultedAggregate.iqr !== null
                                  ? ` (IQR ${v.evidence.faultedAggregate.iqr.toFixed(1)})`
                                  : ''
                              }`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="verdict-card-field">
                        <span className="verdict-field-label">Baseline Median</span>
                        <span className="verdict-field-value cell-mono">
                          {v.evidence.baselineAggregate && v.evidence.baselineAggregate.median !== null
                            ? `${v.evidence.baselineAggregate.median.toFixed(1)}`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="verdict-card-reason" style={{ marginTop: 6 }}>
                      <span className="verdict-field-label">Empirical Finding</span>
                      <p className="verdict-reason-text">
                        {formatEmpiricalFinding(v)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Performance Distribution */}
          <div className="report-medians-section">
            <div className="run-audit-section-title" style={{ marginBottom: 8 }}>
              Performance Distribution
            </div>
            <div className="summary-grid">
              <div className="summary-metric-box">
                <span className="summary-label">p50 Latency</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.p50Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p50Ms)} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">p99 Latency</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.p99Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p99Ms)} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">Error Rate</span>
                <span className="summary-value cell-mono">
                  {card?.authoritativeMetrics.errorRate !== undefined
                    ? `${(card.authoritativeMetrics.errorRate * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="summary-metric-box">
                <span className="summary-label">Run Outcome</span>
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

          {/* Section 3: Architecture Topology Snapshot */}
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
                Architecture Topology
              </div>
              {report.diagramSvg && (
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="reports-download-btn"
                  title="Export Scalable Vector Diagram"
                  style={{ padding: '2px 8px', fontSize: 10 }}
                >
                  Download .svg
                </button>
              )}
            </div>

            <div
              style={{
                minHeight: 180,
                background: 'var(--color-bg)',
                borderRadius: 8,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-border)',
                padding: 12,
              }}
            >
              {report.diagramSvg ? (
                <div
                  style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: report.diagramSvg }}
                />
              ) : card?.content ? (
                card.mimeType === 'image/svg+xml' ? (
                  <div
                    style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{ __html: card.content }}
                  />
                ) : (
                  <img
                    src={card.content}
                    alt="System Topology Diagram"
                    style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }}
                  />
                )
              ) : (
                <p className="state-message" style={{ margin: 0 }}>
                  No topology diagram available for this run.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'markdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Architecture Decision Record (Markdown)
            </span>
            <button
              type="button"
              className="reports-download-btn"
              onClick={handleCopyMarkdown}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {copiedMarkdown ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
          </div>
          <div
            style={{
              background: 'var(--color-bg)',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              overflow: 'auto',
              maxHeight: 520,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 11.5,
                lineHeight: 1.5,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {report.markdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
