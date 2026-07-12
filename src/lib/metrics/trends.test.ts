import { describe, expect, it } from "vitest";
import { buildTimeSeries, detectAnomalies, movingAverage, periodGrowthRate, weekdaySeasonality } from "./trends";
import type { MappedRow } from "../../types/domain";

function row(overrides: Partial<MappedRow>): MappedRow {
  return {
    date: null, orderId: null, transactionId: null, customerId: null, customerName: null,
    product: null, category: null, quantity: null, revenue: null, cost: null, profit: null,
    discount: null, channel: null, region: null, country: null, latitude: null, longitude: null,
    rating: null, reviewText: null, marketingSource: null, campaign: null, status: null,
    sourceIndex: 0, ...overrides,
  };
}

describe("buildTimeSeries", () => {
  it("sums revenue per day and sorts chronologically", () => {
    const rows = [
      row({ date: new Date("2024-01-02"), revenue: 10 }),
      row({ date: new Date("2024-01-01"), revenue: 5 }),
      row({ date: new Date("2024-01-01"), revenue: 7 }),
    ];
    const series = buildTimeSeries(rows, "day");
    expect(series).toHaveLength(2);
    expect(series[0].date.toISOString().slice(0, 10)).toBe("2024-01-01");
    expect(series[0].value).toBe(12);
    expect(series[1].value).toBe(10);
  });

  it("excludes rows with a null date or null value", () => {
    const rows = [row({ date: null, revenue: 100 }), row({ date: new Date("2024-01-01"), revenue: null })];
    expect(buildTimeSeries(rows, "day")).toHaveLength(0);
  });
});

describe("movingAverage", () => {
  it("returns null until the window is filled, then the correct rolling mean", () => {
    const series = [1, 2, 3, 4, 5].map((value, i) => ({ date: new Date(2024, 0, i + 1), value }));
    const result = movingAverage(series, 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });
});

describe("detectAnomalies", () => {
  it("flags a sharp spike against a stable baseline", () => {
    const values = [10, 10, 10, 10, 10, 10, 10, 10, 100]; // window=7 baseline, spike at the end
    const series = values.map((value, i) => ({ date: new Date(2024, 0, i + 1), value }));
    const flags = detectAnomalies(series, 7, 2);
    expect(flags.some((f) => f.value === 100)).toBe(true);
  });

  it("flags nothing when the series is flat", () => {
    const values = Array(10).fill(50);
    const series = values.map((value, i) => ({ date: new Date(2024, 0, i + 1), value }));
    expect(detectAnomalies(series, 7, 2)).toHaveLength(0);
  });

  it("returns no flags when there are fewer points than window + 1", () => {
    const series = [1, 2, 3].map((value, i) => ({ date: new Date(2024, 0, i + 1), value }));
    expect(detectAnomalies(series, 7, 2)).toHaveLength(0);
  });
});

describe("periodGrowthRate", () => {
  it("computes a positive growth rate", () => {
    const previous = [{ date: new Date("2024-01-01"), value: 100 }];
    const current = [{ date: new Date("2024-02-01"), value: 150 }];
    expect(periodGrowthRate(current, previous)).toBeCloseTo(0.5, 5);
  });

  it("returns null when the base period is zero", () => {
    const previous = [{ date: new Date("2024-01-01"), value: 0 }];
    const current = [{ date: new Date("2024-02-01"), value: 150 }];
    expect(periodGrowthRate(current, previous)).toBeNull();
  });
});

describe("weekdaySeasonality", () => {
  it("indexes each weekday relative to the overall mean", () => {
    // Two Mondays at 200, rest of week at 100 -> Monday index should exceed 1
    const series = [
      { date: new Date("2024-01-01"), value: 200 }, // Monday
      { date: new Date("2024-01-02"), value: 100 }, // Tuesday
      { date: new Date("2024-01-08"), value: 200 }, // Monday
      { date: new Date("2024-01-09"), value: 100 }, // Tuesday
    ];
    const result = weekdaySeasonality(series);
    const monday = result.find((r) => r.weekday === new Date("2024-01-01").getDay());
    expect(monday?.index).toBeGreaterThan(1);
  });
});
