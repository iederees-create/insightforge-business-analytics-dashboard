import { useMemo, useState } from "react";
import { buildTimeSeries, detectAnomalies, movingAverage } from "../../lib/metrics/trends";
import type { Granularity } from "../../lib/metrics/trends";
import { forecastSeries, MIN_POINTS_FOR_FORECAST } from "../../lib/metrics/forecast";
import { useDatasetStore } from "../../store/datasetStore";
import { formatAxisDate, formatCurrency, formatShortDate } from "../../utils/format";
import { LineChart } from "../charts/LineChart";
import { EmptyState } from "../common/EmptyState";

const GRANULARITY_WINDOW: Record<Granularity, number> = { day: 7, week: 4, month: 3 };
const PERIOD_OPTIONS = [3, 6, 12];

/** Trends & Forecast: moving-average overlay with adjustable-sensitivity anomaly flags, plus an explainable trend forecast. */
export function TrendsForecastView() {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [sensitivity, setSensitivity] = useState(2);
  const [periodsAhead, setPeriodsAhead] = useState(6);

  const series = useMemo(() => buildTimeSeries(mappedRows, granularity, "revenue"), [mappedRows, granularity]);
  const window = GRANULARITY_WINDOW[granularity];
  const ma = useMemo(() => movingAverage(series, window), [series, window]);
  const anomalies = useMemo(() => detectAnomalies(series, window, sensitivity), [series, window, sensitivity]);
  const forecast = useMemo(() => forecastSeries(series, periodsAhead), [series, periodsAhead]);

  if (!mapping.revenue || !mapping.date) {
    return <EmptyState title="Trends & forecasting need Date and Revenue" description="Map both a Date and a Revenue column in the Import Wizard to unlock this view." />;
  }

  const trendPoints = forecast.available
    ? [...forecast.historical, ...forecast.forecast].map((p) => ({ x: p.date, y: p.value }))
    : [];
  const trendBand = forecast.available
    ? [...forecast.historical, ...forecast.forecast].map((p) => ({ lower: p.lower, upper: p.upper }))
    : [];

  return (
    <section aria-labelledby="trends-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trends-heading" className="text-xl font-semibold text-text">
          Trends & Forecast
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="granularity-select" className="text-sm font-medium text-text">
            Group by
          </label>
          <select
            id="granularity-select"
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text">Revenue trend with moving average</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="sensitivity-slider" className="text-sm text-text-muted">
              Anomaly sensitivity ({sensitivity.toFixed(1)}σ)
            </label>
            <input
              id="sensitivity-slider"
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Lower sensitivity flags more points. {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} flagged
          at the current setting, based on deviation from a {window}-period rolling mean.
        </p>
        <div className="mt-3">
          <LineChart
            title="Revenue over time with moving average"
            series={[
              { id: "revenue", name: "Revenue", points: series.map((p) => ({ x: p.date, y: p.value })) },
              { id: "moving-average", name: `${window}-period moving average`, points: series.map((p, i) => ({ x: p.date, y: ma[i] })) },
            ]}
            formatValue={formatCurrency}
            formatX={(x) => (x instanceof Date ? formatAxisDate(x, granularity) : String(x))}
            highlightIndexes={anomalies.map((a) => a.index)}
          />
        </div>
        {anomalies.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
            {anomalies.map((a) => (
              <li key={a.date.toISOString()} className="rounded-full border border-danger px-2 py-0.5 text-danger">
                {formatShortDate(a.date)}: {formatCurrency(a.value)} (expected ~{formatCurrency(a.expected)})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text">Forecast</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="periods-select" className="text-sm text-text-muted">
              Periods ahead
            </label>
            <select
              id="periods-select"
              value={periodsAhead}
              onChange={(event) => setPeriodsAhead(Number(event.target.value))}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text"
            >
              {PERIOD_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {forecast.available ? (
          <>
            <div className="mt-3">
              <LineChart
                title="Historical revenue with forecast and uncertainty band"
                series={[{ id: "trend", name: `${forecast.method} (shaded = uncertainty range)`, points: trendPoints, band: trendBand }]}
                formatValue={formatCurrency}
                formatX={(x) => (x instanceof Date ? formatAxisDate(x, granularity) : String(x))}
                boundaryIndex={forecast.historical.length - 1}
              />
            </div>
            <p className="mt-2 rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-muted">{forecast.explanation}</p>
          </>
        ) : (
          <p role="status" className="mt-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
            Forecasting is not available yet: {forecast.unavailableReason ?? `at least ${MIN_POINTS_FOR_FORECAST} data points are needed.`}
          </p>
        )}
      </div>
    </section>
  );
}
