import type { TimeSeriesPoint } from "./trends";

export interface ForecastPoint {
  date: Date;
  value: number;
  lower: number;
  upper: number;
  isForecast: boolean;
}

export interface ForecastResult {
  available: boolean;
  unavailableReason?: string;
  method: string;
  historical: ForecastPoint[];
  forecast: ForecastPoint[];
  explanation: string;
}

const MIN_POINTS_FOR_FORECAST = 14;
const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Simple, transparent forecast: linear regression on the recent trend plus the recent
 * mean level, widened by the residual standard deviation into an uncertainty band that
 * grows with distance into the future. Deliberately NOT a black-box model — Part 12
 * requires the method to be explainable and to avoid false precision.
 */
export function forecastSeries(series: TimeSeriesPoint[], periodsAhead: number): ForecastResult {
  if (series.length < MIN_POINTS_FOR_FORECAST) {
    return {
      available: false,
      unavailableReason: `Forecasting needs at least ${MIN_POINTS_FOR_FORECAST} historical data points; this dataset has ${series.length}.`,
      method: "none",
      historical: [],
      forecast: [],
      explanation: "",
    };
  }

  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.value);
  const { slope, intercept, residualStdDev } = linearRegression(xs, ys);

  const historical: ForecastPoint[] = series.map((point, i) => {
    const fitted = intercept + slope * i;
    return { date: point.date, value: point.value, lower: fitted, upper: fitted, isForecast: false };
  });

  const stepMs = n > 1 ? series[n - 1].date.getTime() - series[n - 2].date.getTime() : DAY_MS;
  const forecast: ForecastPoint[] = [];
  for (let step = 1; step <= periodsAhead; step += 1) {
    const x = n - 1 + step;
    const predicted = Math.max(0, intercept + slope * x);
    // Uncertainty widens with distance into the future — honest about declining confidence.
    const band = residualStdDev * Math.sqrt(step) * 1.28; // ~80% interval under a normal approximation
    forecast.push({
      date: new Date(series[n - 1].date.getTime() + stepMs * step),
      value: predicted,
      lower: Math.max(0, predicted - band),
      upper: predicted + band,
      isForecast: true,
    });
  }

  return {
    available: true,
    method: "Linear trend extrapolation",
    historical,
    forecast,
    explanation:
      "This forecast fits a straight-line trend to recent history and projects it forward. " +
      "The shaded range widens the further out the forecast goes, reflecting growing uncertainty. " +
      "It does not account for seasonality, promotions, or external events, and is not a guarantee of future results.",
  };
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; residualStdDev: number } {
  const n = xs.length;
  const meanX = xs.reduce((t, x) => t + x, 0) / n;
  const meanY = ys.reduce((t, y) => t + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  const residuals = xs.map((x, i) => ys[i] - (intercept + slope * x));
  const residualVariance = residuals.reduce((t, r) => t + r ** 2, 0) / Math.max(1, n - 2);

  return { slope, intercept, residualStdDev: Math.sqrt(residualVariance) };
}

export { MIN_POINTS_FOR_FORECAST };
