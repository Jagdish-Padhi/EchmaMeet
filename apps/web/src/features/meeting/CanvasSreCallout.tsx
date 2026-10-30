import { useState } from 'react';
import type { SreHazard } from './types';

export interface CanvasSreCalloutProps {
  readonly hazard: SreHazard | null | undefined;
  readonly onOpenDetails: () => void;
  readonly onTestInSandbox: () => void;
}

export function CanvasSreCallout({
  hazard,
  onOpenDetails,
  onTestInSandbox,
}: CanvasSreCalloutProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!hazard || dismissed) return null;

  // Format concise faang-grade summary text
  const cleanTitle = hazard.title.replace('Cascading ', '').replace(' Vulnerability', ' Risk');

  return (
    <aside className="canvas-sre-callout" aria-label="Meta AI SRE Risk Finding" role="region">
      <div className="callout-header">
        <div className="callout-title-wrap" onClick={onOpenDetails} role="button" tabIndex={0}>
          <span className="callout-pulse-dot" aria-hidden="true" />
          <span className="callout-title">Meta AI SRE &bull; {cleanTitle}</span>
        </div>
        <button
          type="button"
          className="callout-close-btn"
          onClick={() => setDismissed(true)}
          title="Dismiss callout"
          aria-label="Dismiss callout"
        >
          &times;
        </button>
      </div>

      <p className="callout-description">
        {hazard.risk.length > 120 ? `${hazard.risk.slice(0, 117)}...` : hazard.risk}
      </p>

      <div className="callout-footer">
        <button
          type="button"
          className="callout-action-btn"
          onClick={onTestInSandbox}
          title="Run isolated 5s chaos injection in physical sandbox"
        >
          <span>Test in Sandbox &rarr;</span>
        </button>
      </div>
    </aside>
  );
}
