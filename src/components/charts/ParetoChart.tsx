import { scaleBand, scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";
import { ChartDataTable } from "./ChartDataTable";
import type { ParetoPoint } from "../../lib/metrics/products";

export interface ParetoChartProps {
  title: string;
  points: ParetoPoint[];
  formatValue?: (value: number) => string;
  width?: number;
  height?: number;
  /** Only render the first N items on the bar axis to keep long tails readable; still uses all points for the cumulative line. */
  maxBars?: number;
}

const MARGIN = { top: 16, right: 44, bottom: 56, left: 56 };

/** Combo bar + cumulative-share line chart for 80/20 (Pareto) analysis. */
export function ParetoChart({ title, points, formatValue = String, width = 560, height = 300, maxBars = 15 }: ParetoChartProps) {
  if (points.length === 0) {
    return <p className="text-sm text-text-muted">No data available for this chart.</p>;
  }

  const visible = points.slice(0, maxBars);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const bandScale = scaleBand<string>().domain(visible.map((p) => p.label)).range([0, innerWidth]).padding(0.3);
  const valueScale = scaleLinear()
    .domain([0, Math.max(...visible.map((p) => p.value)) || 1])
    .range([innerHeight, 0])
    .nice();
  const shareScale = scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  const eightyPercentIndex = points.findIndex((p) => p.cumulativeShare >= 0.8);
  const itemsFor80 = eightyPercentIndex === -1 ? points.length : eightyPercentIndex + 1;

  const lineGen = d3line<ParetoPoint>()
    .x((p) => (bandScale(p.label) ?? 0) + bandScale.bandwidth() / 2)
    .y((p) => shareScale(p.cumulativeShare));

  const summary = `${title}. ${points.length} items ranked by value. ${itemsFor80} item(s) (${((itemsFor80 / points.length) * 100).toFixed(0)}% of items) account for 80% of the total.`;

  return (
    <figure className="w-full">
      <svg role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" style={{ maxHeight: height }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <line x1={0} x2={innerWidth} y1={shareScale(0.8)} y2={shareScale(0.8)} className="stroke-text-muted" strokeWidth={1} strokeDasharray="3,3" />
          <text x={innerWidth} y={shareScale(0.8) - 4} textAnchor="end" className="fill-text-muted text-[10px]">
            80% threshold
          </text>

          {visible.map((p, i) => {
            const x = bandScale(p.label) ?? 0;
            const barHeight = innerHeight - valueScale(p.value);
            return (
              <g key={p.label} className="chart-color-1">
                <rect x={x} y={valueScale(p.value)} width={bandScale.bandwidth()} height={Math.max(barHeight, 1)} fill="var(--mark)" opacity={i < itemsFor80 ? 1 : 0.45} rx={2} />
                <text x={x + bandScale.bandwidth() / 2} y={innerHeight + 14} textAnchor="end" transform={`rotate(-40 ${x + bandScale.bandwidth() / 2} ${innerHeight + 14})`} className="fill-text-muted text-[9px]">
                  {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
                </text>
              </g>
            );
          })}

          <path
            d={lineGen(visible) ?? undefined}
            fill="none"
            className="chart-color-4"
            stroke="var(--mark)"
            strokeWidth={2}
            strokeDasharray="6,3"
          />
          {visible.map((p) => (
            <circle
              key={`${p.label}-marker`}
              cx={(bandScale(p.label) ?? 0) + bandScale.bandwidth() / 2}
              cy={shareScale(p.cumulativeShare)}
              r={3}
              className="chart-color-4"
              fill="var(--mark)"
            />
          ))}

          {shareScale.ticks(5).map((t) => (
            <text key={t} x={innerWidth + 8} y={shareScale(t)} dy="0.32em" className="fill-text-muted text-[10px]">
              {(t * 100).toFixed(0)}%
            </text>
          ))}
          {valueScale.ticks(4).map((t) => (
            <text key={t} x={-8} y={valueScale(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[10px]">
              {formatValue(t)}
            </text>
          ))}
        </g>
      </svg>
      <ul className="mt-2 flex gap-4 text-xs text-text-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5 chart-color-1">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ background: "var(--mark)" }} />
          Value per item
        </li>
        <li className="flex items-center gap-1.5 chart-color-4">
          <span className="inline-block h-2 w-4 rounded-sm border-t-2 border-dashed" style={{ borderColor: "var(--mark)" }} />
          Cumulative share
        </li>
      </ul>
      <figcaption className="sr-only">{summary}</figcaption>
      <ChartDataTable
        caption={summary}
        headers={["Item", "Value", "Cumulative share"]}
        rows={points.map((p) => [p.label, formatValue(p.value), `${(p.cumulativeShare * 100).toFixed(1)}%`])}
      />
    </figure>
  );
}
