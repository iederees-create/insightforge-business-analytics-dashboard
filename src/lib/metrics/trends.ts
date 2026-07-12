import type { MappedRow } from "../../types/domain";

export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export type Granularity = "day" | "week" | "month";

function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === "day") return date.toISOString().slice(0, 10);
  if (granularity === "month") return date.toISOString().slice(0, 7);
  // week: ISO week starting Monday
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d.toISOString().slice(0, 10);
}

/** Aggregates revenue (or another summable field) into a sorted time series (Part 12). */
export function buildTimeSeries(rows: MappedRow[], granularity: Granularity, field: "revenue" | "quantity" | "profit" = "revenue"): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    if (!row.date || row[field] === null) continue;
    const key = bucketKey(row.date, granularity);
    buckets.set(key, (buckets.get(key) ?? 0) + (row[field] as number));
  }
  return [...buckets.entries()]
    .map(([key, value]) => ({ date: new Date(key), value }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Simple moving average over the last `window` points (inclusive of current point). */
export function movingAverage(series: TimeSeriesPoint[], window: number): (number | null)[] {
  return series.map((_, i) => {
    if (i + 1 < window) return null;
    const slice = series.slice(i + 1 - window, i + 1);
    return slice.reduce((total, p) => total + p.value, 0) / window;
  });
}

export interface AnomalyFlag {
  index: number;
  date: Date;
  value: number;
  expected: number;
  deviationRatio: number;
}

/**
 * Flags points that deviate from a rolling mean by more than `sensitivity` standard deviations.
 * Lower sensitivity = more flags. Requires at least `window + 1` points.
 */
export function detectAnomalies(series: TimeSeriesPoint[], window = 7, sensitivity = 2): AnomalyFlag[] {
  if (series.length < window + 1) return [];
  const flags: AnomalyFlag[] = [];
  for (let i = window; i < series.length; i += 1) {
    const slice = series.slice(i - window, i);
    const mean = slice.reduce((total, p) => total + p.value, 0) / window;
    const variance = slice.reduce((total, p) => total + (p.value - mean) ** 2, 0) / window;
    const stdDev = Math.sqrt(variance);
    const point = series[i];
    if (stdDev === 0) {
      // A perfectly flat baseline has no natural scale to divide by — any deviation from
      // it is still a real anomaly (e.g. a single spike against constant-value history).
      if (point.value !== mean) {
        flags.push({ index: i, date: point.date, value: point.value, expected: mean, deviationRatio: Infinity });
      }
      continue;
    }
    const deviationRatio = Math.abs(point.value - mean) / stdDev;
    if (deviationRatio >= sensitivity) {
      flags.push({ index: i, date: point.date, value: point.value, expected: mean, deviationRatio });
    }
  }
  return flags;
}

/** Growth rate between two summed periods, expressed as a fraction (0.1 = +10%). Null when the base period is zero. */
export function periodGrowthRate(current: TimeSeriesPoint[], previous: TimeSeriesPoint[]): number | null {
  const currentTotal = current.reduce((total, p) => total + p.value, 0);
  const previousTotal = previous.reduce((total, p) => total + p.value, 0);
  if (previousTotal === 0) return null;
  return (currentTotal - previousTotal) / previousTotal;
}

/**
 * Naive seasonality indicator: average value per weekday, expressed as an index vs the overall mean
 * (1.0 = average day, 1.2 = 20% above average). Transparent and easy to sanity-check.
 */
export function weekdaySeasonality(series: TimeSeriesPoint[]): { weekday: number; index: number }[] {
  if (series.length === 0) return [];
  const overallMean = series.reduce((total, p) => total + p.value, 0) / series.length;
  if (overallMean === 0) return [];
  const byWeekday = new Map<number, number[]>();
  for (const point of series) {
    const weekday = point.date.getDay();
    const list = byWeekday.get(weekday) ?? [];
    list.push(point.value);
    byWeekday.set(weekday, list);
  }
  return [...byWeekday.entries()]
    .map(([weekday, values]) => ({
      weekday,
      index: values.reduce((total, v) => total + v, 0) / values.length / overallMean,
    }))
    .sort((a, b) => a.weekday - b.weekday);
}
