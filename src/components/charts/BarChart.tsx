import { scaleBand, scaleLinear } from "d3-scale";
import { max } from "d3-array";
import { ChartDataTable } from "./ChartDataTable";
import { colorClassFor } from "./types";
import type { CategoryDatum } from "./types";

export interface BarChartProps {
  title: string;
  data: CategoryDatum[];
  /** Formats a raw value for the axis/tooltip/table (e.g. currency). */
  formatValue?: (value: number) => string;
  width?: number;
  height?: number;
  horizontal?: boolean;
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 100 };

/** Simple accessible categorical bar chart, horizontal by default (reads well for ranked lists). */
export function BarChart({ title, data, formatValue = String, width = 480, height = 280, horizontal = true }: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-text-muted">No data available for this chart.</p>;
  }

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const maxValue = max(data, (d) => d.value) ?? 0;
  const minValue = Math.min(0, ...data.map((d) => d.value));

  const bandScale = scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range(horizontal ? [0, innerHeight] : [0, innerWidth])
    .padding(0.25);
  const valueScale = scaleLinear()
    .domain([minValue, maxValue || 1])
    .range(horizontal ? [0, innerWidth] : [innerHeight, 0])
    .nice();

  const highest = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]);
  const lowest = data.reduce((worst, d) => (d.value < worst.value ? d : worst), data[0]);
  const summary = `${title}. ${data.length} categories, ranging from ${formatValue(lowest.value)} (${lowest.label}) to ${formatValue(highest.value)} (${highest.label}).`;

  return (
    <figure className="w-full">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        style={{ maxHeight: height }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {data.map((d, i) => {
            const band = bandScale(d.label) ?? 0;
            const colorClass = colorClassFor(i);
            if (horizontal) {
              const zeroX = valueScale(0);
              const barX = valueScale(Math.min(0, d.value));
              const barWidth = Math.abs(valueScale(d.value) - zeroX);
              return (
                <g key={d.label} className={colorClass}>
                  <rect
                    x={barX}
                    y={band}
                    width={Math.max(barWidth, 1)}
                    height={bandScale.bandwidth()}
                    fill="var(--mark)"
                    rx={2}
                  />
                  <text
                    x={-8}
                    y={band + bandScale.bandwidth() / 2}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-text text-[10px]"
                  >
                    {d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label}
                  </text>
                  <text
                    x={valueScale(d.value) + (d.value >= 0 ? 4 : -4)}
                    y={band + bandScale.bandwidth() / 2}
                    dy="0.32em"
                    textAnchor={d.value >= 0 ? "start" : "end"}
                    className="fill-text-muted text-[10px]"
                  >
                    {formatValue(d.value)}
                  </text>
                </g>
              );
            }
            const zeroY = valueScale(0);
            const barY = valueScale(Math.max(0, d.value));
            const barHeight = Math.abs(zeroY - valueScale(d.value));
            return (
              <g key={d.label} className={colorClass}>
                <rect x={band} y={barY} width={bandScale.bandwidth()} height={Math.max(barHeight, 1)} fill="var(--mark)" rx={2} />
                <text x={band + bandScale.bandwidth() / 2} y={innerHeight + 14} textAnchor="middle" className="fill-text-muted text-[10px]">
                  {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
                </text>
              </g>
            );
          })}
          <line x1={0} y1={horizontal ? innerHeight : valueScale(0)} x2={horizontal ? innerWidth : innerWidth} y2={horizontal ? innerHeight : valueScale(0)} className="stroke-border" strokeWidth={1} />
        </g>
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
      <ChartDataTable
        caption={summary}
        headers={["Category", "Value"]}
        rows={data.map((d) => [d.label, formatValue(d.value)])}
      />
    </figure>
  );
}
