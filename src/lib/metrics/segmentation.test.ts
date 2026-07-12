import { describe, expect, it } from "vitest";
import { computeSegmentation, DEFAULT_SEGMENTATION_THRESHOLDS } from "./segmentation";
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

describe("computeSegmentation", () => {
  it("is unavailable without both customerId and date", () => {
    const result = computeSegmentation([row({ revenue: 10 })]);
    expect(result.available).toBe(false);
  });

  it("classifies a single-order customer as New", () => {
    const rows = [row({ customerId: "c1", date: new Date("2024-06-01"), revenue: 50 })];
    const result = computeSegmentation(rows);
    expect(result.customers[0].segment).toBe("New");
  });

  it("classifies a high-frequency recent customer as Loyal", () => {
    const rows = Array.from({ length: DEFAULT_SEGMENTATION_THRESHOLDS.loyalOrderCount }, (_, i) =>
      row({ customerId: "c1", date: new Date(2024, 5, i + 1), revenue: 20 }),
    );
    const result = computeSegmentation(rows);
    expect(result.customers[0].segment).toBe("Loyal");
    expect(result.customers[0].frequency).toBe(DEFAULT_SEGMENTATION_THRESHOLDS.loyalOrderCount);
  });

  it("classifies high lifetime revenue as High Value even with low frequency", () => {
    const rows = [row({ customerId: "c1", date: new Date("2024-06-01"), revenue: DEFAULT_SEGMENTATION_THRESHOLDS.highValueRevenue + 1 })];
    const result = computeSegmentation(rows);
    expect(result.customers[0].segment).toBe("High Value");
  });

  it("classifies a customer whose last order is far in the past as Inactive", () => {
    const asOf = new Date("2024-12-01");
    const oldOrder = new Date(asOf.getTime() - (DEFAULT_SEGMENTATION_THRESHOLDS.inactiveDays + 5) * 86_400_000);
    const rows = [
      row({ customerId: "c1", date: oldOrder, revenue: 10 }),
      row({ customerId: "other", date: asOf, revenue: 10 }), // establishes asOfDate as the dataset's latest date
    ];
    const result = computeSegmentation(rows);
    const target = result.customers.find((c) => c.customerId === "c1");
    expect(target?.segment).toBe("Inactive");
  });

  it("computes revenue share per segment summing to 1", () => {
    const rows = [
      row({ customerId: "c1", date: new Date("2024-06-01"), revenue: 100 }),
      row({ customerId: "c2", date: new Date("2024-06-01"), revenue: 300 }),
    ];
    const result = computeSegmentation(rows);
    const totalShare = result.summaries.reduce((t, s) => t + s.revenueShare, 0);
    expect(totalShare).toBeCloseTo(1, 5);
  });
});
