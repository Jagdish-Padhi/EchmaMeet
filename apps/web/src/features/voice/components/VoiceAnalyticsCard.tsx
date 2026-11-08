import React, { useEffect, useState } from 'react';
import type { ApiClient, VoiceAnalytics } from '../../../api/client';

export interface VoiceAnalyticsCardProps {
  readonly api: ApiClient;
  /** Changes whenever a command completes so the card refreshes. */
  readonly refreshKey: string;
}

export const VoiceAnalyticsCard: React.FC<VoiceAnalyticsCardProps> = ({ api, refreshKey }) => {
  const [data, setData] = useState<VoiceAnalytics | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getVoiceAnalytics(controller.signal)
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [api, refreshKey]);

  if (!data || data.total === 0) return null;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(15,23,42,0.75)',
        fontSize: 12,
        color: '#cbd5e1',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        Voice ledger • {data.backend === 'postgres' ? 'PostgreSQL' : 'in-memory'}
      </div>
      <div>
        {String(data.total)} commands
        {data.successRatePct !== null && <> • {String(data.successRatePct)}% understood</>}
        {data.sttLatencyMs && (
          <>
            {' '}
            • STT p50 {String(data.sttLatencyMs.p50)}ms / p95 {String(data.sttLatencyMs.p95)}ms
          </>
        )}
      </div>
      <div style={{ marginTop: 4, color: '#94a3b8' }}>
        {data.byLanguage.map((l) => `${l.language}: ${String(l.count)}`).join('  ')}
      </div>
    </div>
  );
};
