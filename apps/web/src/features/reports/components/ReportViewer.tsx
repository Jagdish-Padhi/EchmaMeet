import { useState, useEffect } from 'react';
import type { ApiClient } from '../../../api/client';
import type { RunId, ReportExport, BlueprintCard } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface ReportViewerProps {
  api: ApiClient;
  runId: RunId;
}

export function ReportViewer({ api, runId }: ReportViewerProps) {
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
      <Card title="Run Report & Artifact Export">
        <p style={{ color: '#64748b' }}>Loading report data for {runId}...</p>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card title="Run Report & Artifact Export">
        <p style={{ color: '#ef4444' }}>Error: {error ?? 'Unable to retrieve report'}</p>
      </Card>
    );
  }

  return (
    <Card title="Run Report & Artifact Export">
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setActiveView('summary');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background:
                activeView === 'summary' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#1e293b',
              color: '#f8fafc',
              border: activeView === 'summary' ? '1px solid #38bdf8' : '1px solid #475569',
              boxShadow: activeView === 'summary' ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Summary &amp; Card
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('diagram');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background:
                activeView === 'diagram' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#1e293b',
              color: '#f8fafc',
              border: activeView === 'diagram' ? '1px solid #38bdf8' : '1px solid #475569',
              boxShadow: activeView === 'diagram' ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Deterministic SVG
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('markdown');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background:
                activeView === 'markdown' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#1e293b',
              color: '#f8fafc',
              border: activeView === 'markdown' ? '1px solid #38bdf8' : '1px solid #475569',
              boxShadow: activeView === 'markdown' ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Markdown Preview
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Export .md
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Export .json
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Export .svg
          </button>
        </div>
      </div>

      {/* Provenance Banner */}
      <div
        style={{
          background: '#0f172a',
          padding: '10px 14px',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 12,
          color: '#94a3b8',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 8,
          border: '1px solid #1e293b',
        }}
      >
        <div>
          <span style={{ color: '#64748b' }}>Run ID: </span>
          <span style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{report.runId}</span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Commit: </span>
          <span style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>
            {report.provenance.gitCommit}
          </span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Host: </span>
          <span>{report.provenance.hostDescription}</span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Node / Toxiproxy: </span>
          <span>
            {report.provenance.nodeVersion} / {report.provenance.toxiproxyVersion}
          </span>
        </div>
      </div>

      {activeView === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: Authoritative Numbers */}
          <div
            style={{
              background: '#0f172a',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #1e293b',
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                color: '#f8fafc',
                fontSize: 14,
                borderBottom: '1px solid #334155',
                paddingBottom: 6,
              }}
            >
              Authoritative Empirical Verdicts
            </h4>
            {report.verdicts.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>No invariant verdicts recorded.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Invariant</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.verdicts.map((v) => (
                    <tr key={v.invariantId} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td
                        style={{
                          padding: '6px 4px',
                          color: '#f1f5f9',
                          fontFamily: 'monospace',
                        }}
                      >
                        {v.invariantId}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 'bold',
                            fontSize: 11,
                            background: v.status === 'PASS' ? '#14532d' : '#7f1d1d',
                            color: v.status === 'PASS' ? '#86efac' : '#fca5a5',
                          }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', color: '#94a3b8', fontSize: 11 }}>
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
                margin: '16px 0 8px 0',
                color: '#f8fafc',
                fontSize: 14,
                borderBottom: '1px solid #334155',
                paddingBottom: 6,
              }}
            >
              Faulted Distribution (Medians)
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: 4 }}>
                <span style={{ color: '#94a3b8' }}>p50 Latency: </span>
                <strong style={{ color: '#f8fafc' }}>
                  {card?.authoritativeMetrics.p50Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p50Ms)}ms`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: 4 }}>
                <span style={{ color: '#94a3b8' }}>p99 Latency: </span>
                <strong style={{ color: '#f8fafc' }}>
                  {card?.authoritativeMetrics.p99Ms !== undefined
                    ? `${String(card.authoritativeMetrics.p99Ms)}ms`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: 4 }}>
                <span style={{ color: '#94a3b8' }}>Error Rate: </span>
                <strong style={{ color: '#f8fafc' }}>
                  {card?.authoritativeMetrics.errorRate !== undefined
                    ? `${String(Math.round(card.authoritativeMetrics.errorRate * 100))}%`
                    : 'N/A'}
                </strong>
              </div>
              <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: 4 }}>
                <span style={{ color: '#94a3b8' }}>Status: </span>
                <strong
                  style={{
                    color: report.status === 'completed' ? '#86efac' : '#fca5a5',
                  }}
                >
                  {report.status}
                </strong>
              </div>
            </div>
          </div>

          {/* Right: Blueprint Card / Illustrative Rendering */}
          <div
            style={{
              background: '#0f172a',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #1e293b',
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
              <h4 style={{ margin: 0, color: '#f8fafc', fontSize: 14 }}>Blueprint Card</h4>
              <span
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#334155',
                  color: '#94a3b8',
                }}
              >
                Illustrative Rendering
              </span>
            </div>

            {card?.fallbackReason && (
              <div
                style={{
                  background: '#2d1810',
                  color: '#fdba74',
                  border: '1px solid #7c2d12',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: 11,
                  marginBottom: 10,
                }}
              >
                <strong>Degraded: </strong>
                {card.fallbackReason}
              </div>
            )}

            <div
              style={{
                flex: 1,
                minHeight: 200,
                background: '#020617',
                borderRadius: 6,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #1e293b',
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
                  style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }}
                />
              ) : (
                <p style={{ color: '#64748b' }}>No diagram available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'diagram' && (
        <div
          style={{
            background: '#020617',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #334155',
            overflow: 'auto',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: report.diagramSvg }} />
        </div>
      )}

      {activeView === 'markdown' && (
        <div
          style={{
            background: '#090d16',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #334155',
            overflow: 'auto',
            maxHeight: 500,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              fontFamily: 'monospace',
              color: '#cbd5e1',
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
