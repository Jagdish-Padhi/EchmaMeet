import React from 'react';
import type { Fault, RedStrokeDetectionResult } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface GestureResultBannerProps {
  readonly result: RedStrokeDetectionResult;
  readonly onApplyFault?: (fault: Fault) => void;
  readonly onSelectCandidate?: (edgeId: string) => void;
}

export const GestureResultBanner: React.FC<GestureResultBannerProps> = ({
  result,
  onApplyFault,
  onSelectCandidate,
}) => {
  const { detector, selection } = result;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Gesture Detection:</span>
        <Badge variant={detector === 'sam' ? 'accent' : 'neutral'}>
          Detector: {detector === 'sam' ? 'SAM 3.1' : 'Color Threshold'}
        </Badge>
      </div>

      {selection.status === 'selected' && (
        <Alert variant="success">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Target Edge Selected:</strong> {selection.source} -&gt; {selection.target}{' '}
              (ID: {selection.edgeId})
              <div style={{ fontSize: 12, marginTop: 4, color: '#1e293b' }}>
                Proposed Fault: {selection.proposedFault.type} (300ms latency, 50ms jitter)
              </div>
            </div>
            {onApplyFault && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onApplyFault(selection.proposedFault)}
              >
                Apply to Experiment
              </Button>
            )}
          </div>
        </Alert>
      )}

      {selection.status === 'ambiguous' && (
        <Alert variant="warning">
          <strong>Ambiguous Intersection:</strong> {selection.message}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {selection.candidates.map((candId) => (
              <Button
                key={candId}
                variant="ghost"
                size="sm"
                onClick={() => onSelectCandidate?.(candId)}
              >
                Choose {candId}
              </Button>
            ))}
          </div>
        </Alert>
      )}

      {selection.status === 'none' && <Alert variant="info">{selection.message}</Alert>}
    </div>
  );
};
