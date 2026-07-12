import { useId } from "react";
import { arc as d3arc, pie as d3pie } from "d3-shape";
import { ChartDataTable } from "./ChartDataTable";
import { colorClassFor } from "./types";
import type { CategoryDatum } from "./types";

export interface DonutChartProps {
  title: string;
  data: CategoryDatum[];
  formatValue?: (value: number) => string;
  size?: number;
}

/** Six fill patterns paired with the six categorical colors, so adjacent wedges never rely on hue alone. */
const PATTERN_KINDS = ["solid", "diagonal", "dots", "cross", "vertical", "horizontal"] as const;

function PatternDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      {PATTERN_KINDS.map((kind, i) => {
        const patternId = `${idPrefix}-${kind}`;
        const colorClass = colorClassFor(i);
        if (kind === "solid") {
          return null;
        }
        return (
          <pattern key={patternId} id={patternId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(0)" className={colorClass}>
            <rect width={6} height={6} fill="var(--mark)" opacity={0.9} />
            {kind === "diagonal" && <path d="M0,6 L6,0" stroke="white" strokeOpacity={0.55} strokeWidth={1.5} />}
            {kind === "dots" && <circle cx={3} cy={3} r={1} fill="white" fillOpacity={0.7} />}
            {kind === "cross" && (
              <>
                <path d="M0,3 H6" stroke="white" strokeOpacity={0.55} strokeWidth={1} />
                <path d="M3,0 V6" stroke="white" strokeOpacity={0.55} strokeWidth={1} />
              </>
            )}
            {kind === "vertical" && <path d="M3,0 V6" stroke="white" strokeOpacity={0.55} strokeWidth={1.5} />}
            {kind === "horizontal" && <path d="M0,3 H6" stroke="white" strokeOpacity={0.55} strokeWidth={1.5} />}
          </pattern>
        );
      })}
    </defs>
  );
}

function fillFor(index: number, idPrefix: string): string {
  const kind = PATTERN_KINDS[index % PATTERN_KINDS.length];
  return kind === "solid" ? "var(--mark)" : `url(#${idPrefix}-${kind})`;
}

/** Accessible donut/pie chart. Every wedge is differentiated by color, pattern, and a labeled legend. */
export function DonutChart({ title, data, formatValue = String, size = 240 }: DonutChartProps) {
  const rawId = useId();
  const idPrefix = rawId.replace(/[^a-zA-Z0-9-]/g, "");
  const total = data.reduce((t, d) => t + d.value, 0);

  if (data.length === 0 || total <= 0) {
    return <p className="text-sm text-text-muted">No data available for this chart.</p>;
  }

  const radius = size / 2;
  const pieGen = d3pie<CategoryDatum>().value((d) => d.value).sort(null);
  const arcGen = d3arc<ReturnType<typeof pieGen>[number]>().innerRadius(radius * 0.55).outerRadius(radius - 4);
  const arcs = pieGen(data);

  const summary = `${title}. ${data.length} segments: ${data
    .map((d) => `${d.label} ${((d.value / total) * 100).toFixed(0)}%`)
    .join(", ")}.`;

  return (
    <figure className="w-full">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
        <svg role="img" aria-label={summary} viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
          <PatternDefs idPrefix={idPrefix} />
          <g transform={`translate(${radius},${radius})`}>
            {arcs.map((arcDatum, i) => (
              <path key={arcDatum.data.label} d={arcGen(arcDatum) ?? undefined} fill={fillFor(i, idPrefix)} stroke="var(--color-surface)" strokeWidth={1.5} />
            ))}
          </g>
        </svg>
        <ul className="flex flex-col gap-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0 rounded-sm border border-border"
                style={{ background: fillFor(i, idPrefix) }}
              />
              <span className="text-text">{d.label}</span>
              <span className="text-text-muted">
                {formatValue(d.value)} ({((d.value / total) * 100).toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      <ChartDataTable
        caption={summary}
        headers={["Segment", "Value", "Share"]}
        rows={data.map((d) => [d.label, formatValue(d.value), `${((d.value / total) * 100).toFixed(1)}%`])}
      />
    </figure>
  );
}
