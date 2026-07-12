import { describe, expect, it } from "vitest";
import { forecastSeries, MIN_POINTS_FOR_FORECAST } from "./forecast";
import type { TimeSeriesPoint } from "./trends";

function series(values: number[], startDate = "2024-01-01"): TimeSeriesPoint[] {
  const start = new Date(startDate);
  return values.map((value, i) => ({ date: new Date(start.getTime() + i * 86_400_000), value }));
}

describe("forecastSeries", () => {
  it("is unavailable below the minimum point threshold", () => {
    const result = forecastSeries(series(Array.from({ length: MIN_POINTS_FOR_FORECAST - 1 }, (_, i) => i)), 7);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toContain(String(MIN_POINTS_FOR_FORECAST));
  });

  it("projects a perfectly linear series forward with near-zero uncertainty", () => {
    // y = 10 + 5x, no noise: the fitted line should recover slope/intercept exactly
    // and the forecast should continue the trend with a very tight band.
    const values = Array.from({ length: 20 }, (_, i) => 10 + 5 * i);
    const result = forecastSeries(series(values), 5);

    expect(result.available).toBe(true);
    expect(result.forecast).toHaveLength(5);

    const nextExpected = 10 + 5 * 20; // one step past the last historical index (19)
    expect(result.forecast[0].value).toBeCloseTo(nextExpected, 5);
    expect(result.forecast[0].upper - result.forecast[0].lower).toBeLessThan(0.01);
  });

  it("widens the uncertainty band the further into the future it forecasts", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 + 3 * i + (i % 3 === 0 ? 15 : -5)); // noisy trend
    const result = forecastSeries(series(values), 6);

    const firstBand = result.forecast[0].upper - result.forecast[0].lower;
    const lastBand = result.forecast[5].upper - result.forecast[5].lower;
    expect(lastBand).toBeGreaterThan(firstBand);
  });

  it("never predicts negative revenue even for a strongly declining trend", () => {
    const values = Array.from({ length: 20 }, (_, i) => Math.max(0, 200 - 15 * i));
    const result = forecastSeries(series(values), 10);
    for (const point of result.forecast) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.lower).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces one forecast point per historical time step", () => {
    const values = Array.from({ length: 15 }, (_, i) => 50 + i);
    const pointsAhead = 4;
    const result = forecastSeries(series(values), pointsAhead);
    expect(result.forecast).toHaveLength(pointsAhead);
    result.forecast.forEach((point, i) => {
      if (i > 0) {
        const stepMs = point.date.getTime() - result.forecast[i - 1].date.getTime();
        expect(stepMs).toBeCloseTo(86_400_000, -3);
      }
    });
  });
});
