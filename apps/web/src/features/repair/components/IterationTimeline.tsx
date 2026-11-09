import type { RepairIterationRecord } from '@chaosboard/contracts';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { PatchDiffCard } from './PatchDiffCard';

export interface IterationTimelineProps {
  readonly iterations: readonly RepairIterationRecord[];
}

export function IterationTimeline({ iterations }: IterationTimelineProps) {
  if (iterations.length === 0) {
    return null;
  }

  return (
    <Card title="Optimization Iteration Timeline" className="timeline-card">
      <div className="timeline-list">
        {iterations.map((it) => {
          const isAccepted = it.decision === 'accept';
          const totalTokens =
            (it.modelCallMetadata?.tokenCounts?.promptTokens ?? 0) +
            (it.modelCallMetadata?.tokenCounts?.completionTokens ?? 0);

          return (
            <div key={it.iterationIndex} className="timeline-item">
              <div className="timeline-item-header">
                <span className="iteration-badge">Iteration #{String(it.iterationIndex)}</span>
                <StatusPill
                  status={isAccepted ? 'PASS' : 'VIOLATED'}
                  label={it.decision ? it.decision.toUpperCase() : 'PENDING'}
                />
                {it.modelCallMetadata && (
                  <Badge variant="neutral">
                    {it.modelCallMetadata.modelId} ({String(it.modelCallMetadata.latencyMs)}ms)
                  </Badge>
                )}
                {totalTokens > 0 && (
                  <span className="token-usage-tag cell-mono">Tokens: {String(totalTokens)}</span>
                )}
              </div>

              <div className="timeline-body">
                {it.patch && (
                  <>
                    <div className="rationale-box">
                      <strong>Proposal Hypothesis:</strong>
                      <p>{it.patch.hypothesis}</p>
                    </div>
                    <PatchDiffCard patch={it.patch} />
                  </>
                )}

                <div className="decision-box">
                  <span className="decision-title">Decision ({it.decision ?? 'pending'}):</span>{' '}
                  <span className="decision-reason">{it.decisionReason}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
