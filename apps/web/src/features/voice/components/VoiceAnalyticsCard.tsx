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
    <div className="voice-analytics-card">
      <div className="voice-label-title">
        Voice Ledger • {data.backend === 'postgres' ? 'PostgreSQL' : 'In-Memory'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text)' }}>
        {String(data.total)} commands
        {data.successRatePct !== null && <> • {String(data.successRatePct)}% understood</>}
        {data.sttLatencyMs && (
          <>
            {' '}
            • STT p50 {String(data.sttLatencyMs.p50)}ms / p95 {String(data.sttLatencyMs.p95)}ms
          </>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-dim)' }}>
        {data.byLanguage.map((l) => `${l.language}: ${String(l.count)}`).join('  ')}
      </div>
    </div>
  );
};
