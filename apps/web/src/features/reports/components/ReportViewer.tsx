import { useState, useEffect } from 'react';
import type { ApiClient } from '../../../api/client';
import type { RunId, ReportExport, BlueprintCard } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

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
      <Card title={hideTitle ? undefined : 'Run Report & Artifact Export'}>
        <div
          className="drawer-loading-box"
          style={{ border: 'none', padding: '10px 4px', background: 'transparent' }}
        >
          <div className="drawer-loading-header">
            <span className="agentic-pulse-spinner" />
            <span className="drawer-loading-label">
              Loading report data for <span className="cell-mono">{runId}</span>...
            </span>
          </div>
          <div className="drawer-loading-indeterminate" />
        </div>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card title={hideTitle ? undefined : 'Run Report & Artifact Export'}>
        <p className="state-message" style={{ color: 'var(--color-danger, #ef4444)' }}>
          Error: {error ?? 'Unable to retrieve report'}
        </p>
      </Card>
    );
  }

  return (
    <Card title={hideTitle ? undefined : 'Run Report & Artifact Export'}>
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setActiveView('summary')}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background:
                activeView === 'summary' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeView === 'summary' ? '#ffffff' : 'var(--color-text)',
              border: activeView === 'summary' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Summary &amp; Card
          </button>
          <button
            type="button"
            onClick={() => setActiveView('diagram')}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background:
                activeView === 'diagram' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeView === 'diagram' ? '#ffffff' : 'var(--color-text)',
              border: activeView === 'diagram' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Topology SVG
          </button>
          <button
            type="button"
            onClick={() => setActiveView('markdown')}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background:
                activeView === 'markdown' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeView === 'markdown' ? '#ffffff' : 'var(--color-text)',
              border: activeView === 'markdown' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Markdown
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            .md
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            .json
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            .svg
          </button>
        </div>
      </div>

      {/* Provenance Banner */}
      <div
        style={{
          background: 'var(--color-surface)',
          padding: '8px 12px',
          borderRadius: 6,
          marginBottom: 14,
          fontSize: 11,
          color: 'var(--color-text-muted)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 6,
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <span style={{ color: 'var(--color-text-dim)' }}>Run: </span>
          <span style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{report.runId}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-dim)' }}>Commit: </span>
          <span style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>
            {report.provenance.gitCommit}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-dim)' }}>Host: </span>
          <span>{report.provenance.hostDescription}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-dim)' }}>Runtime: </span>
          <span>
            {report.provenance.nodeVersion}
          </span>
        </div>
      </div>

      {activeView === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Authoritative Numbers */}
          <div
            style={{
              background: 'var(--color-surface)',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
            }}
          >
            <h4
              style={{
                margin: '0 0 10px 0',
                color: 'var(--color-text)',
                fontSize: 13,
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 6,
              }}
            >
              Authoritative Empirical Verdicts
            </h4>
            {report.verdicts.length === 0 ? (
              <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No invariant verdicts recorded.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '5px 4px' }}>Invariant</th>
                    <th style={{ textAlign: 'left', padding: '5px 4px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '5px 4px' }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.verdicts.map((v) => (
                    <tr key={v.invariantId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td
                        style={{
                          padding: '5px 4px',
                          color: 'var(--color-text)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {v.invariantId}
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 'bold',
                            fontSize: 10,
                            background: v.status === 'PASS' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: v.status === 'PASS' ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '5px 4px', color: 'var(--color-text-muted)', fontSize: 11 }}>
                        {v.reason ??
                          `${v.evidence.metric} ${v.evidence.comparator} ${String(v.evidence.threshold)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4
              style={{
                margin: '14px 0 8px 0',
                color: 'var(--color-text)',
                fontSize: 13,
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 6,
              }}
            >
              Faulted Distribution Medians
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                fontSize: 11,
              }}
            >
              <div style={{ background: 'var(--color-surface-hover, rgba(255,255,255,0.04))', padding: '6px 8px', borderRadius: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>p50 Latency: </span>
                <strong style={{ color: 'var(--color-text)' }}>
                  {card?.authoritativeMetrics.p50Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p50Ms)}ms`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-hover, rgba(255,255,255,0.04))', padding: '6px 8px', borderRadius: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>p99 Latency: </span>
                <strong style={{ color: 'var(--color-text)' }}>
                  {card?.authoritativeMetrics.p99Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p99Ms)}ms`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-hover, rgba(255,255,255,0.04))', padding: '6px 8px', borderRadius: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Error Rate: </span>
                <strong style={{ color: 'var(--color-text)' }}>
                  {card?.authoritativeMetrics.errorRate !== undefined
                    ? `${String(Math.round(card.authoritativeMetrics.errorRate * 100))}%`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-hover, rgba(255,255,255,0.04))', padding: '6px 8px', borderRadius: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Status: </span>
                <strong
                  style={{
                    color: report.status === 'completed' ? '#22c55e' : '#ef4444',
                  }}
                >
                  {report.status}
                </strong>
              </div>
            </div>
          </div>

          {/* Blueprint Card / Illustrative Rendering */}
          <div
            style={{
              background: 'var(--color-surface)',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h4 style={{ margin: 0, color: 'var(--color-text)', fontSize: 13 }}>Topology Architecture</h4>
              <span
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--color-surface-hover, rgba(255,255,255,0.08))',
                  color: 'var(--color-text-muted)',
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
                  borderRadius: 4,
                  padding: '6px 8px',
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
                flex: 1,
                minHeight: 180,
                background: 'var(--color-bg)',
                borderRadius: 6,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-border)',
              }}
            >
              {card?.mimeType === 'image/svg+xml' ? (
                <div
                  style={{ width: '100%', height: '100%' }}
                  dangerouslySetInnerHTML={{ __html: card.content }}
                />
              ) : card?.content ? (
                <img
                  src={card.content}
                  alt="System Blueprint Card"
                  style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }}
                />
              ) : (
                <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No diagram available</p>
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
    </Card>
  );
}
