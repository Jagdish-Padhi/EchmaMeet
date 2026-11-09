import { memo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import type { ExperimentTelemetryPoint } from '../types';

export interface LiveTelemetryChartProps {
  readonly telemetry: readonly ExperimentTelemetryPoint[];
  readonly currentTrial: number;
  readonly totalTrials: number;
}

export const LiveTelemetryChart = memo(function LiveTelemetryChart({
  telemetry,
  currentTrial,
  totalTrials,
}: LiveTelemetryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (telemetry.length === 0) {
    const isSimulating = currentTrial > 0;
    return (
      <Card title="Tail Latency & Error Rate" className="telemetry-card">
        <div className="empty-chart-state" style={{ padding: '14px 12px', textAlign: 'center' }}>
          {isSimulating ? (
            <div className="telemetry-measuring-row" style={{ justifyContent: 'center' }}>
              <span className="agentic-pulse-spinner" />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Measuring trial {String(currentTrial)} of {String(totalTrials)}...
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
              Telemetry streams live during simulation.
            </span>
          )}
        </div>
      </Card>
    );
  }

  // Derive bounding box from real data points
  const p99Values = telemetry
    .map((t) => t.p99LatencyMs)
    .filter((v): v is number => v !== undefined && !Number.isNaN(v));
  const maxLatency = Math.max(100, ...p99Values, 200);

  const width = 540;
  const height = 190;
  const paddingLeft = 46;
  const paddingRight = 46;
  const paddingTop = 20;
  const paddingBottom = 32;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map points to SVG coordinates (dual axis)
  const points = telemetry.map((pt, i) => {
    const x =
      paddingLeft +
      (telemetry.length === 1 ? chartWidth / 2 : (i / (telemetry.length - 1)) * chartWidth);
    const latencyVal = pt.p99LatencyMs ?? 0;
    const yLatency = paddingTop + chartHeight - (latencyVal / maxLatency) * chartHeight;

    const errorRateVal = pt.errorRate ?? 0;
    const yError = paddingTop + chartHeight - Math.min(1, Math.max(0, errorRateVal)) * chartHeight;

    return {
      index: i,
      trialNum: i + 1,
      x,
      yLatency,
      yError,
      latency: latencyVal,
      errorRatePct: errorRateVal * 100,
    };
  });

  const latencyPathD = points.reduce((acc, pt, i) => {
    return `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.yLatency.toFixed(1)}`;
  }, '');

  const errorPathD = points.reduce((acc, pt, i) => {
    return `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.yError.toFixed(1)}`;
  }, '');

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // KPI Quick Stats
  const latestPt = points[points.length - 1];
  const peakLatency = p99Values.length > 0 ? Math.max(...p99Values) : 0;
  const peakError = Math.max(...telemetry.map((t) => (t.errorRate ?? 0) * 100));

  return (
    <Card
      title="Tail Latency & Error Rate"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="metric-pill">
            Trial {String(currentTrial)}/{String(totalTrials)}
          </span>
        </div>
      }
      className="telemetry-card"
    >
      {/* 1. High-Density Telemetry KPI Stat Strip */}
      <div className="telemetry-stats-bar">
        <div className="telemetry-stat-box">
          <span className="stat-label">Latest p99</span>
          <span className="stat-value cyan">
            {latestPt ? `${Math.round(latestPt.latency)}ms` : '—'}
          </span>
        </div>
        <div className="telemetry-stat-box">
          <span className="stat-label">Peak p99</span>
          <span className="stat-value">
            {peakLatency > 0 ? `${Math.round(peakLatency)}ms` : '—'}
          </span>
        </div>
        <div className="telemetry-stat-box">
          <span className="stat-label">Peak Error</span>
          <span className={`stat-value ${peakError > 0 ? 'rose' : ''}`}>
            {peakError.toFixed(1)}%
          </span>
        </div>
        <div className="telemetry-stat-box">
          <span className="stat-label">Evaluated</span>
          <span className="stat-value">
            {String(telemetry.length)} / {String(totalTrials)}
          </span>
        </div>
      </div>

      {/* 2. Chart Legend */}
      <div className="telemetry-legend-row">
        <div className="legend-item">
          <span className="legend-indicator-line cyan" />
          <span className="legend-text cyan">p99 Latency (ms)</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator-line rose dashed" />
          <span className="legend-text rose">Error Rate (%)</span>
        </div>
      </div>

      {/* 3. Responsive SVG Chart */}
      <div className="chart-wrapper">
        <svg
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="telemetry-svg"
          aria-label="Real-time latency and error rate chart over trials"
          role="img"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Grid lines */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={width - paddingRight}
            y2={paddingTop}
            className="chart-gridline"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight / 2}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight / 2}
            className="chart-gridline"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight}
            className="chart-axis"
          />

          {/* Left Y-Axis labels (p99 Latency ms) */}
          <text x={paddingLeft - 6} y={paddingTop + 4} className="chart-label" textAnchor="end">
            {String(Math.round(maxLatency))}ms
          </text>
          <text
            x={paddingLeft - 6}
            y={paddingTop + chartHeight / 2 + 4}
            className="chart-label"
            textAnchor="end"
          >
            {String(Math.round(maxLatency / 2))}ms
          </text>
          <text
            x={paddingLeft - 6}
            y={paddingTop + chartHeight + 4}
            className="chart-label"
            textAnchor="end"
          >
            0ms
          </text>

          {/* Right Y-Axis labels (Error Rate %) */}
          <text
            x={width - paddingRight + 6}
            y={paddingTop + 4}
            className="chart-label"
            textAnchor="start"
            fill="#f87171"
          >
            100%
          </text>
          <text
            x={width - paddingRight + 6}
            y={paddingTop + chartHeight / 2 + 4}
            className="chart-label"
            textAnchor="start"
            fill="#f87171"
          >
            50%
          </text>
          <text
            x={width - paddingRight + 6}
            y={paddingTop + chartHeight + 4}
            className="chart-label"
            textAnchor="start"
            fill="#f87171"
          >
            0%
          </text>

          {/* Latency Line (Cyan) */}
          {points.length > 1 && (
            <path
              d={latencyPathD}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))' }}
            />
          )}

          {/* Error Rate Line (Rose Red Dashed) */}
          {points.length > 1 && (
            <path
              d={errorPathD}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="5 3"
              style={{ filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.4))' }}
            />
          )}

          {/* Data Points */}
          {points.map((pt, i) => (
            <g key={String(i)} onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: 'pointer' }}>
              <circle cx={pt.x} cy={pt.yLatency} r={14} fill="transparent" />

              <circle
                cx={pt.x}
                cy={pt.yLatency}
                r={hoveredIdx === i ? 6 : 4}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={2}
              />

              <circle
                cx={pt.x}
                cy={pt.yError}
                r={hoveredIdx === i ? 5 : 3.5}
                fill="#f43f5e"
                stroke="var(--color-bg)"
                strokeWidth={1.5}
              />

              <text
                x={pt.x}
                y={paddingTop + chartHeight + 18}
                fontSize={10}
                fill="var(--color-text-dim)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                T{String(pt.trialNum)}
              </text>
            </g>
          ))}

          {/* Interactive Hover Crosshair */}
          {hoveredPoint && (
            <g pointerEvents="none">
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={paddingTop + chartHeight}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-hover-tooltip"
            style={{
              left: Math.min(Math.max(10, hoveredPoint.x - 60), width - 150),
            }}
          >
            <div className="tooltip-title">Trial #{String(hoveredPoint.trialNum)}</div>
            <div className="tooltip-row cyan">p99: {Math.round(hoveredPoint.latency)}ms</div>
            <div className="tooltip-row rose">Error: {hoveredPoint.errorRatePct.toFixed(1)}%</div>
          </div>
        )}
      </div>
    </Card>
  );
});
