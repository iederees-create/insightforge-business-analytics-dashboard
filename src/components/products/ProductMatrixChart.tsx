import { scaleLinear } from "d3-scale";
import { max, min } from "d3-array";
import { ChartDataTable } from "../charts/ChartDataTable";
import type { ProductMatrixPoint } from "../../lib/metrics/products";
import { formatCurrency, formatPercent } from "../../utils/format";

export interface ProductMatrixChartProps {
  points: ProductMatrixPoint[];
  width?: number;
  height?: number;
}

const QUADRANT_META: Record<ProductMatrixPoint["quadrant"], { label: string; colorClass: string; marker: string }> = {
  star: { label: "Star (high revenue, growing)", colorClass: "chart-color-3", marker: "●" },
  steady: { label: "Steady (high revenue, flat/declining)", colorClass: "chart-color-1", marker: "■" },
  emerging: { label: "Emerging (low revenue, growing)", colorClass: "chart-color-4", marker: "▲" },
  declining: { label: "Declining (low revenue, flat/declining)", colorClass: "chart-color-5", marker: "✕" },
};

const MARGIN = { top: 16, right: 16, bottom: 32, left: 60 };

/** Revenue-vs-growth quadrant scatter for the product performance matrix. Each quadrant has a distinct color AND marker shape. */
export function ProductMatrixChart({ points, width = 520, height = 340 }: ProductMatrixChartProps) {
  const withGrowth = points.filter((p) => p.growthRate !== null);
  if (withGrowth.length === 0) {
    return <p className="text-sm text-text-muted">Not enough comparable history to plot the product matrix yet.</p>;
  }

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = scaleLinear()
    .domain([min(withGrowth, (p) => p.growthRate as number) ?? -1, max(withGrowth, (p) => p.growthRate as number) ?? 1])
    .range([0, innerWidth])
    .nice();
  const yScale = scaleLinear()
    .domain([0, max(withGrowth, (p) => p.revenue) ?? 1])
    .range([innerHeight, 0])
    .nice();

  const summary = `Product matrix: revenue vs. growth rate for ${withGrowth.length} product(s), split into star, steady, emerging, and declining quadrants.`;

  return (
    <figure className="w-full">
      <svg role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" style={{ maxHeight: height }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <line x1={xScale(0)} x2={xScale(0)} y1={0} y2={innerHeight} className="stroke-border" strokeWidth={1} />
          {yScale.ticks(4).map((t) => (
            <text key={t} x={-8} y={yScale(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[10px]">
              {formatCurrency(t)}
            </text>
          ))}
          {xScale.ticks(4).map((t) => (
            <text key={t} x={xScale(t)} y={innerHeight + 16} textAnchor="middle" className="fill-text-muted text-[10px]">
              {formatPercent(t)}
            </text>
          ))}
          {withGrowth.map((p) => {
            const meta = QUADRANT_META[p.quadrant];
            return (
              <g key={p.label} className={meta.colorClass}>
                <circle cx={xScale(p.growthRate as number)} cy={yScale(p.revenue)} r={6} fill="var(--mark)" opacity={0.85} />
                <text x={xScale(p.growthRate as number)} y={yScale(p.revenue)} dy="-0.6em" textAnchor="middle" className="fill-text text-[9px]">
                  {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted" aria-hidden="true">
        {(Object.keys(QUADRANT_META) as ProductMatrixPoint["quadrant"][]).map((quadrant) => (
          <li key={quadrant} className={`flex items-center gap-1.5 ${QUADRANT_META[quadrant].colorClass}`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--mark)" }} />
            {QUADRANT_META[quadrant].marker} {QUADRANT_META[quadrant].label}
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{summary}</figcaption>
      <ChartDataTable
        caption={summary}
        headers={["Product", "Revenue", "Growth rate", "Quadrant"]}
        rows={points.map((p) => [p.label, formatCurrency(p.revenue), p.growthRate === null ? "N/A" : formatPercent(p.growthRate), QUADRANT_META[p.quadrant].label])}
      />
    </figure>
  );
}
