import type { RepairPatch } from '@chaosboard/contracts';

export interface PatchDiffCardProps {
  readonly patch: RepairPatch;
}

export function PatchDiffCard({ patch }: PatchDiffCardProps) {
  return (
    <div className="patch-diff-card">
      <div className="patch-diff-header">
        <span className="patch-target">Hypothesis: {patch.hypothesis}</span>
      </div>
      <div className="patch-diff-ops">
        {patch.operations.map((op, idx) => {
          const target = 'edgeId' in op ? `Edge: ${op.edgeId}` : `Node: ${op.nodeId}`;
          return (
            <div key={String(idx)} className="patch-op-row">
              <span className="op-path cell-mono">
                [{op.op}] {target}
              </span>
              <span className="op-desc">{op.rationale}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
