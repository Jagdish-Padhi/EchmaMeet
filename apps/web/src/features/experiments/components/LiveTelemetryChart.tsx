import { Card } from '../../../components/ui/Card';
import type { ExperimentTelemetryPoint } from '../types';

export interface LiveTelemetryChartProps {
  readonly telemetry: readonly ExperimentTelemetryPoint[];
  readonly currentTrial: number;
  readonly totalTrials: number;
}

export function LiveTelemetryChart({
  telemetry,
  currentTrial,
  totalTrials,
}: LiveTelemetryChartProps) {
  if (telemetry.length === 0) {
    return (
      <Card title="Live Telemetry">
        <div className="empty-chart-state">
          <p>No telemetry received yet. Run an experiment to see empirical measurements.</p>
          <span className="subtext">
            Trials: {String(currentTrial)} of {String(totalTrials)}
          </span>
        </div>
      </Card>
    );
  }

  // Derive bounding box from real data points
  const p99Values = telemetry
    .map((t) => t.p99LatencyMs)
    .filter((v): v is number => v !== undefined && !Number.isNaN(v));
  const maxLatency = Math.max(100, ...p99Values, 500);

  const width = 500;
  const height = 180;
  const padding = 35;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Map points to SVG coordinates
  const points = telemetry.map((pt, i) => {
    const x = padding + (i / Math.max(1, telemetry.length - 1)) * chartWidth;
    const yVal = pt.p99LatencyMs ?? 0;
    const y = height - padding - (yVal / maxLatency) * chartHeight;
    return { x, y, latency: yVal, errorRate: pt.errorRate ?? 0 };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  return (
    <Card
      title="Live Telemetry: p99 Latency & Error Rate"
      actions={
        <span className="metric-pill">
          Trial {String(currentTrial)}/{String(totalTrials)}
        </span>
      }
    >
      <div className="chart-wrapper">
        <svg
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="telemetry-svg"
          aria-label="Real-time latency chart over trials"
          role="img"
        >
          {/* Grid lines */}
          <line
            x1={padding}
            y1={padding}
            x2={width - padding}
            y2={padding}
            className="chart-gridline"
          />
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            className="chart-gridline"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            className="chart-axis"
          />

          {/* Y Axis labels */}
          <text x={padding - 6} y={padding + 4} className="chart-label" textAnchor="end">
            {String(Math.round(maxLatency))}ms
          </text>
          <text x={padding - 6} y={height / 2 + 4} className="chart-label" textAnchor="end">
            {String(Math.round(maxLatency / 2))}ms
          </text>
          <text x={padding - 6} y={height - padding + 4} className="chart-label" textAnchor="end">
            0ms
          </text>

          {/* Latency line path */}
          {points.length > 1 && <path d={pathD} className="chart-path-latency" fill="none" />}

          {/* Point circles */}
          {points.map((pt, i) => (
            <g key={String(i)}>
              <circle cx={pt.x} cy={pt.y} r={4} className="chart-point" />
              <text x={pt.x} y={pt.y - 8} className="chart-point-text" textAnchor="middle">
                {String(Math.round(pt.latency))}ms
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Card>
  );
}
