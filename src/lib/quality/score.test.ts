import { describe, expect, it } from "vitest";
import { computeQualityScore, applyCleaning, DEFAULT_CLEANING_OPTIONS } from "./score";
import type { MappedRow, QualityIssue } from "../../types/domain";

function row(overrides: Partial<MappedRow>): MappedRow {
  return {
    date: null, orderId: null, transactionId: null, customerId: null, customerName: null,
    product: null, category: null, quantity: null, revenue: null, cost: null, profit: null,
    discount: null, channel: null, region: null, country: null, latitude: null, longitude: null,
    rating: null, reviewText: null, marketingSource: null, campaign: null, status: null,
    sourceIndex: 0, ...overrides,
  };
}

describe("computeQualityScore", () => {
  it("returns 100 for a dataset with no issues", () => {
    expect(computeQualityScore(100, [])).toBe(100);
  });

  it("returns 100 for zero rows (nothing to penalize)", () => {
    expect(computeQualityScore(0, [])).toBe(100);
  });

  it("penalizes a critical issue more than a low-severity issue of the same size", () => {
    const critical: QualityIssue = { id: "1", title: "x", severity: "critical", column: "row", count: 10, affectedRowIndexes: [], suggestion: "" };
    const low: QualityIssue = { id: "2", title: "y", severity: "low", column: "row", count: 10, affectedRowIndexes: [], suggestion: "" };
    const criticalScore = computeQualityScore(100, [critical]);
    const lowScore = computeQualityScore(100, [low]);
    expect(criticalScore).toBeLessThan(lowScore);
  });

  it("never goes below 0", () => {
    const issues: QualityIssue[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), title: "x", severity: "critical", column: "row", count: 100, affectedRowIndexes: [], suggestion: "",
    }));
    expect(computeQualityScore(100, issues)).toBeGreaterThanOrEqual(0);
  });
});

describe("applyCleaning", () => {
  it("never mutates the original rows array", () => {
    const rows = [row({ product: "  Widget  ", revenue: 10 })];
    const original = JSON.stringify(rows);
    applyCleaning(rows, DEFAULT_CLEANING_OPTIONS);
    expect(JSON.stringify(rows)).toBe(original);
  });

  it("trims whitespace from text fields when enabled", () => {
    const rows = [row({ product: "  Widget   Two  ", revenue: 10 })];
    const result = applyCleaning(rows, { ...DEFAULT_CLEANING_OPTIONS, trimWhitespace: true });
    expect(result.cleanedRows[0].product).toBe("Widget Two");
  });

  it("removes exact duplicate rows when enabled", () => {
    const rows = [row({ orderId: "1", revenue: 10 }), row({ orderId: "1", revenue: 10 })];
    const result = applyCleaning(rows, { ...DEFAULT_CLEANING_OPTIONS, removeExactDuplicates: true, trimWhitespace: false });
    expect(result.cleanedRows).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });

  it("drops negative revenue rows only when explicitly enabled", () => {
    const rows = [row({ orderId: "1", revenue: -10 }), row({ orderId: "2", revenue: 10 })];
    const kept = applyCleaning(rows, { ...DEFAULT_CLEANING_OPTIONS, dropNegativeRevenue: false, trimWhitespace: false, removeExactDuplicates: false });
    expect(kept.cleanedRows).toHaveLength(2);

    const dropped = applyCleaning(rows, { ...DEFAULT_CLEANING_OPTIONS, dropNegativeRevenue: true, trimWhitespace: false, removeExactDuplicates: false });
    expect(dropped.cleanedRows).toHaveLength(1);
    expect(dropped.cleanedRows[0].revenue).toBe(10);
  });
});
