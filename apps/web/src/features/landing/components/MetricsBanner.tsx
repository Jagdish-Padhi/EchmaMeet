import { memo, useEffect, useRef, useState } from 'react';

interface MetricCounterCardProps {
  readonly target: number;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly label: string;
  readonly subtext?: string;
  readonly isTriggered: boolean;
}

const MetricCounterCard = memo(function MetricCounterCard({
  target,
  suffix = '',
  prefix = '',
  label,
  subtext,
  isTriggered,
}: MetricCounterCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isTriggered || target === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 1400;
    let startTimestamp: number | null = null;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(easeOut * target);
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isTriggered, target]);

  return (
    <div className="metric-cell" role="group" aria-label={`${target}${suffix} ${label}`}>
      <div className="metric-number-wrap">
        <span className="metric-number">
          {prefix}
          {displayValue}
          {suffix}
        </span>
      </div>
      <span className="metric-label">{label}</span>
      {subtext && <span className="metric-subtext">{subtext}</span>}
    </div>
  );
});

export const MetricsBanner = memo(function MetricsBanner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsTriggered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="metrics-banner" ref={containerRef}>
      <MetricCounterCard
        target={20}
        suffix=" min"
        label="Avg Architecture Review Time"
        subtext="Down from 3-week RFC syncs"
        isTriggered={isTriggered}
      />
      <MetricCounterCard
        target={80}
        suffix="%"
        label="Outage Blind Spots Caught Live"
        subtext="Before touching production code"
        isTriggered={isTriggered}
      />
      <MetricCounterCard
        target={100}
        suffix="%"
        label="Team Alignment Before Merge"
        subtext="Shared voice & state consensus"
        isTriggered={isTriggered}
      />
      <MetricCounterCard
        target={0}
        suffix=""
        label="Manual Terraform Boilerplate"
        subtext="Instant verified IaC export"
        isTriggered={isTriggered}
      />
    </div>
  );
});
