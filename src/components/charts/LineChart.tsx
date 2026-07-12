import { scaleLinear, scaleTime } from "d3-scale";
import { line as d3line, area as d3area, curveMonotoneX } from "d3-shape";
import { extent, max, min } from "d3-array";
import { ChartDataTable } from "./ChartDataTable";
import { LINE_DASH_PATTERNS, MARKER_SHAPES, colorClassFor } from "./types";
import type { MarkerShape, Series } from "./types";

export interface LineChartProps {
  title: string;
  series: Series[];
  formatValue?: (value: number) => string;
  formatX?: (x: Date | string | number) => string;
  width?: number;
  height?: number;
  /** Marks a vertical boundary (e.g. where history ends and forecast begins). */
  boundaryIndex?: number;
  /** Highlights specific point indexes on the first series (e.g. anomalies). */
  highlightIndexes?: number[];
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 };

function toTime(x: Date | string | number): number {
  if (x instanceof Date) return x.getTime();
  if (typeof x === "number") return x;
  return new Date(x).getTime();
}

function renderMarker(shape: MarkerShape, cx: number, cy: number, colorClass: string, key: string) {
  const size = 3.2;
  switch (shape) {
    case "square":
      return <rect key={key} x={cx - size} y={cy - size} width={size * 2} height={size * 2} fill="var(--mark)" className={colorClass} />;
    case "triangle":
      return <polygon key={key} points={`${cx},${cy - size * 1.2} ${cx - size} ,${cy + size} ${cx + size},${cy + size}`} fill="var(--mark)" className={colorClass} />;
    case "diamond":
      return <polygon key={key} points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`} fill="var(--mark)" className={colorClass} />;
    case "cross":
      return (
        <g key={key} className={colorClass} stroke="var(--mark)" strokeWidth={1.5}>
          <line x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} />
          <line x1={cx - size} y1={cy + size} x2={cx + size} y2={cy - size} />
        </g>
      );
    case "star":
      return <circle key={key} cx={cx} cy={cy} r={size} fill="none" stroke="var(--mark)" className={colorClass} strokeWidth={1.5} />;
    default:
      return <circle key={key} cx={cx} cy={cy} r={size} fill="var(--mark)" className={colorClass} />;
  }
}

/** Multi-series line chart with optional shaded uncertainty bands (for forecasts) and anomaly markers. */
export function LineChart({
  title,
  series,
  formatValue = String,
  formatX = String,
  width = 560,
  height = 280,
  boundaryIndex,
  highlightIndexes = [],
}: LineChartProps) {
  const allPoints = series.flatMap((s) => s.points.filter((p) => p.y !== null));
  if (allPoints.length === 0) {
    return <p className="text-sm text-text-muted">No data available for this chart.</p>;
  }

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xDomain = extent(allPoints, (p) => toTime(p.x)) as [number, number];
  const bandValues = series.flatMap((s) => s.band?.flatMap((b) => [b.lower, b.upper]) ?? []);
  const yMax = max([...allPoints.map((p) => p.y as number), ...bandValues]) ?? 1;
  const yMin = Math.min(0, min([...allPoints.map((p) => p.y as number), ...bandValues]) ?? 0);

  const xScale = scaleTime().domain(xDomain).range([0, innerWidth]);
  const yScale = scaleLinear().domain([yMin, yMax || 1]).range([innerHeight, 0]).nice();

  const lineGen = d3line<{ x: number; y: number }>()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))
    .curve(curveMonotoneX);
  const areaGen = d3area<{ x: number; lower: number; upper: number }>()
    .x((d) => xScale(d.x))
    .y0((d) => yScale(d.lower))
    .y1((d) => yScale(d.upper))
    .curve(curveMonotoneX);

  const first = series[0];
  const firstValues = first.points.filter((p) => p.y !== null).map((p) => p.y as number);
  const summary =
    series.length === 1
      ? `${title}. ${first.name}, ranging from ${formatValue(Math.min(...firstValues))} to ${formatValue(Math.max(...firstValues))}, trending ${
          firstValues[firstValues.length - 1] >= firstValues[0] ? "upward" : "downward"
        } over ${firstValues.length} points.`
      : `${title}. ${series.length} series: ${series.map((s) => s.name).join(", ")}.`;

  const tickCount = Math.min(6, allPoints.length);
  const xTicks = xScale.ticks(tickCount);
  const yTicks = yScale.ticks(4);

  return (
    <figure className="w-full">
      <svg role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" style={{ maxHeight: height }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} className="stroke-border" strokeWidth={1} strokeDasharray="2,3" />
              <text x={-8} y={yScale(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[10px]">
                {formatValue(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t.getTime()} x={xScale(t)} y={innerHeight + 16} textAnchor="middle" className="fill-text-muted text-[10px]">
              {formatX(t)}
            </text>
          ))}

          {boundaryIndex !== undefined && first.points[boundaryIndex] && (
            <line
              x1={xScale(toTime(first.points[boundaryIndex].x))}
              x2={xScale(toTime(first.points[boundaryIndex].x))}
              y1={0}
              y2={innerHeight}
              className="stroke-text-muted"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {series.map((s, seriesIndex) => {
            const colorClass = colorClassFor(seriesIndex);
            const points = s.points.filter((p) => p.y !== null).map((p) => ({ x: toTime(p.x), y: p.y as number }));
            const bandData =
              s.band && s.points.length === s.band.length
                ? s.points.map((p, i) => ({ x: toTime(p.x), lower: s.band![i].lower, upper: s.band![i].upper }))
                : null;
            return (
              <g key={s.id}>
                {bandData && (
                  <path d={areaGen(bandData) ?? undefined} className={colorClass} fill="var(--mark)" opacity={0.15} stroke="none" />
                )}
                <path
                  d={lineGen(points) ?? undefined}
                  fill="none"
                  className={colorClass}
                  stroke="var(--mark)"
                  strokeWidth={2}
                  strokeDasharray={LINE_DASH_PATTERNS[seriesIndex % LINE_DASH_PATTERNS.length]}
                />
                {points.map((p, i) =>
                  renderMarker(MARKER_SHAPES[seriesIndex % MARKER_SHAPES.length], xScale(p.x), yScale(p.y), colorClass, `${s.id}-${i}`),
                )}
                {seriesIndex === 0 &&
                  highlightIndexes.map((idx) => {
                    const point = points[idx];
                    if (!point) return null;
                    return (
                      <circle
                        key={`highlight-${idx}`}
                        cx={xScale(point.x)}
                        cy={yScale(point.y)}
                        r={7}
                        fill="none"
                        className="stroke-danger"
                        strokeWidth={2}
                      />
                    );
                  })}
              </g>
            );
          })}
        </g>
      </svg>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted" aria-hidden="true">
          {series.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-1.5 ${colorClassFor(i)}`}>
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: "var(--mark)" }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <figcaption className="sr-only">{summary}</figcaption>
      <ChartDataTable
        caption={summary}
        headers={["X", ...series.map((s) => s.name)]}
        rows={first.points.map((p, i) => [
          formatX(p.x),
          ...series.map((s) => (s.points[i]?.y !== null && s.points[i]?.y !== undefined ? formatValue(s.points[i].y as number) : "—")),
        ])}
      />
    </figure>
  );
}
