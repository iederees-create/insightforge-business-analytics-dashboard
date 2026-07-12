import { describe, expect, it } from "vitest";
import { computeKpis } from "./kpis";
import type { ColumnMapping, MappedRow } from "../../types/domain";

function row(overrides: Partial<MappedRow>): MappedRow {
  return {
    date: null, orderId: null, transactionId: null, customerId: null, customerName: null,
    product: null, category: null, quantity: null, revenue: null, cost: null, profit: null,
    discount: null, channel: null, region: null, country: null, latitude: null, longitude: null,
    rating: null, reviewText: null, marketingSource: null, campaign: null, status: null,
    sourceIndex: 0, ...overrides,
  };
}

describe("computeKpis", () => {
  it("marks revenue-dependent metrics unavailable when revenue was not mapped", () => {
    const mapping: ColumnMapping = { orderId: "Order ID" };
    const rows = [row({ orderId: "1" }), row({ orderId: "2" })];
    const kpis = computeKpis(rows, mapping);
    expect(kpis.revenue.available).toBe(false);
    expect(kpis.averageOrderValue.available).toBe(false);
    expect(kpis.orders.available).toBe(true);
    expect(kpis.orders.value).toBe(2);
  });

  it("computes revenue, AOV, and profit margin correctly from mapped columns", () => {
    const mapping: ColumnMapping = { orderId: "id", revenue: "rev", cost: "cost" };
    const rows = [
      row({ orderId: "A", revenue: 100, cost: 40 }),
      row({ orderId: "B", revenue: 200, cost: 80 }),
    ];
    const kpis = computeKpis(rows, mapping);
    expect(kpis.revenue.value).toBe(300);
    expect(kpis.orders.value).toBe(2);
    expect(kpis.averageOrderValue.value).toBe(150);
    expect(kpis.cost.value).toBe(120);
    expect(kpis.profit.value).toBe(180); // revenue - cost, since no explicit profit column
    expect(kpis.profitMargin.value).toBeCloseTo(0.6, 5);
  });

  it("computes repeat-customer rate and new/returning split", () => {
    const mapping: ColumnMapping = { customerId: "cust", revenue: "rev" };
    const rows = [
      row({ customerId: "c1", revenue: 10 }),
      row({ customerId: "c1", revenue: 10 }),
      row({ customerId: "c2", revenue: 10 }),
    ];
    const kpis = computeKpis(rows, mapping);
    expect(kpis.repeatCustomerRate.value).toBeCloseTo(0.5, 5); // 1 of 2 unique customers is repeat
    expect(kpis.returningCustomerCount.value).toBe(1);
    expect(kpis.newCustomerCount.value).toBe(1);
  });

  it("ranks top products by revenue descending", () => {
    const mapping: ColumnMapping = { product: "p", revenue: "r" };
    const rows = [
      row({ product: "Widget", revenue: 50 }),
      row({ product: "Gadget", revenue: 200 }),
      row({ product: "Widget", revenue: 25 }),
    ];
    const kpis = computeKpis(rows, mapping);
    expect(kpis.topProducts[0].label).toBe("Gadget");
    expect(kpis.topProducts[1].label).toBe("Widget");
    expect(kpis.topProducts[1].revenue).toBe(75);
  });

  it("returns 100% discount-free totals correctly when no discount column is mapped", () => {
    const mapping: ColumnMapping = { revenue: "r" };
    const rows = [row({ revenue: 100 })];
    const kpis = computeKpis(rows, mapping);
    expect(kpis.discountRate.available).toBe(false);
  });
});
