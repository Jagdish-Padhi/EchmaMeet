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
      <Card title="Live Telemetry">
        <div className="empty-chart-state">
          {isSimulating ? (
            <>
              <div className="telemetry-measuring-row">
                <span className="agentic-pulse-spinner" />
                <p style={{ margin: 0 }}>Collecting trial measurements...</p>
              </div>
              <span className="subtext">
                Executing trial {String(currentTrial)} of {String(totalTrials)}. Latency and error
                curves will plot as trials complete.
              </span>
            </>
          ) : (
            <>
              <p>Ready to measure latency and throughput.</p>
              <span className="subtext">
                Click &ldquo;Run Simulation&rdquo; above to benchmark this architecture under
                traffic.
              </span>
            </>
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
  const height = 200;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map points to SVG coordinates (dual axis)
  const points = telemetry.map((pt, i) => {
    const x =
      paddingLeft +
      (telemetry.length === 1 ? chartWidth / 2 : (i / (telemetry.length - 1)) * chartWidth);
    const latencyVal = pt.p99LatencyMs ?? 0;
    const yLatency = paddingTop + chartHeight - (latencyVal / maxLatency) * chartHeight;

    const errorRateVal = pt.errorRate ?? 0; // 0.0 to 1.0 (0% to 100%)
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

  return (
    <Card
      title="Live Telemetry: Tail Latency & Error Rate"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="metric-pill">
            Trial {String(currentTrial)}/{String(totalTrials)}
          </span>
        </div>
      }
    >
      {/* Chart Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          marginBottom: 8,
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 3,
              background: 'var(--color-accent)',
              borderRadius: 2,
            }}
          />
          <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>p99 Latency (ms)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 2,
              background: '#f43f5e',
              borderTop: '2px dashed #f43f5e',
            }}
          />
          <span style={{ color: '#f87171', fontWeight: 600 }}>Error Rate (%)</span>
        </div>
      </div>

      <div className="chart-wrapper" style={{ position: 'relative' }}>
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
              {/* Invisible wide hit area */}
              <circle cx={pt.x} cy={pt.yLatency} r={14} fill="transparent" />

              {/* Latency Point */}
              <circle
                cx={pt.x}
                cy={pt.yLatency}
                r={hoveredIdx === i ? 6 : 4}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={2}
              />

              {/* Error Rate Point */}
              <circle
                cx={pt.x}
                cy={pt.yError}
                r={hoveredIdx === i ? 5 : 3.5}
                fill="#f43f5e"
                stroke="var(--color-bg)"
                strokeWidth={1.5}
              />

              {/* Trial number on X-axis */}
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
            style={{
              position: 'absolute',
              top: 8,
              left: Math.min(hoveredPoint.x + 10, width - 160),
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>
              Trial #{hoveredPoint.trialNum}
            </div>
            <div style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
              p99: {Math.round(hoveredPoint.latency)}ms
            </div>
            <div style={{ color: '#f87171', fontWeight: 600 }}>
              Error: {hoveredPoint.errorRatePct.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});
