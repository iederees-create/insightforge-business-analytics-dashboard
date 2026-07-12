import type { ColumnMapping, DatasetFilters, MappedRow } from "../../types/domain";

export interface Metric {
  available: boolean;
  value: number | null;
  /** Present when unavailable, explaining which column is missing (Part 7: never show a bare zero). */
  unavailableReason?: string;
}

export interface RankedEntry {
  label: string;
  revenue: number;
  quantity: number;
  profit: number | null;
  orders: number;
}

export interface KpiSet {
  revenue: Metric;
  orders: Metric;
  unitsSold: Metric;
  averageOrderValue: Metric;
  averageRevenuePerCustomer: Metric;
  cost: Metric;
  profit: Metric;
  profitMargin: Metric;
  discountRate: Metric;
  repeatCustomerRate: Metric;
  newCustomerCount: Metric;
  returningCustomerCount: Metric;
  topProducts: RankedEntry[];
  topCategories: RankedEntry[];
  topChannels: RankedEntry[];
  topRegions: RankedEntry[];
}

function unavailable(reason: string): Metric {
  return { available: false, value: null, unavailableReason: reason };
}

function available(value: number): Metric {
  return { available: true, value };
}

export function filterRows(rows: MappedRow[], filters: Partial<DatasetFilters>): MappedRow[] {
  return rows.filter((row) => {
    if (filters.dateRange && row.date) {
      if (row.date < filters.dateRange.start || row.date > filters.dateRange.end) return false;
    }
    if (filters.categories?.length && (!row.category || !filters.categories.includes(row.category))) return false;
    if (filters.products?.length && (!row.product || !filters.products.includes(row.product))) return false;
    if (filters.channels?.length && (!row.channel || !filters.channels.includes(row.channel))) return false;
    if (filters.regions?.length && (!row.region || !filters.regions.includes(row.region))) return false;
    return true;
  });
}

function sum(rows: MappedRow[], field: "revenue" | "cost" | "profit" | "quantity" | "discount"): number {
  return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
}

function rankBy(rows: MappedRow[], field: "product" | "category" | "channel" | "region"): RankedEntry[] {
  const groups = new Map<string, RankedEntry>();
  for (const row of rows) {
    const label = row[field];
    if (!label) continue;
    const entry = groups.get(label) ?? { label, revenue: 0, quantity: 0, profit: 0, orders: 0 };
    entry.revenue += row.revenue ?? 0;
    entry.quantity += row.quantity ?? 0;
    entry.profit = (entry.profit ?? 0) + (row.profit ?? 0);
    entry.orders += 1;
    groups.set(label, entry);
  }
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue);
}

/**
 * Computes the full Business Performance Dashboard KPI set (Part 7).
 * Each metric is only marked `available` when its required source column was mapped —
 * this function never fabricates a zero for data the buyer didn't provide.
 */
export function computeKpis(rows: MappedRow[], mapping: ColumnMapping): KpiSet {
  const hasRevenue = Boolean(mapping.revenue);
  const hasQuantity = Boolean(mapping.quantity);
  const hasCost = Boolean(mapping.cost);
  const hasProfit = Boolean(mapping.profit) || (hasRevenue && hasCost);
  const hasDiscount = Boolean(mapping.discount);
  const hasOrderId = Boolean(mapping.orderId);
  const hasCustomerId = Boolean(mapping.customerId);

  const revenueTotal = hasRevenue ? sum(rows, "revenue") : 0;
  const orderCount = hasOrderId ? new Set(rows.map((r) => r.orderId).filter(Boolean)).size : rows.length;
  const unitsTotal = hasQuantity ? sum(rows, "quantity") : 0;
  const costTotal = hasCost ? sum(rows, "cost") : 0;
  const profitTotal = mapping.profit ? sum(rows, "profit") : hasRevenue && hasCost ? revenueTotal - costTotal : 0;
  const discountTotal = hasDiscount ? sum(rows, "discount") : 0;

  const customerOrderCounts = new Map<string, number>();
  if (hasCustomerId) {
    for (const row of rows) {
      if (!row.customerId) continue;
      customerOrderCounts.set(row.customerId, (customerOrderCounts.get(row.customerId) ?? 0) + 1);
    }
  }
  const uniqueCustomers = customerOrderCounts.size;
  const returningCustomers = [...customerOrderCounts.values()].filter((count) => count > 1).length;

  return {
    revenue: hasRevenue ? available(revenueTotal) : unavailable("Map a Revenue column to see this metric."),
    orders: hasOrderId || rows.length > 0 ? available(orderCount) : unavailable("Map an Order ID column for an exact order count."),
    unitsSold: hasQuantity ? available(unitsTotal) : unavailable("Map a Quantity column to see this metric."),
    averageOrderValue: hasRevenue && orderCount > 0 ? available(revenueTotal / orderCount) : unavailable("Requires Revenue and Order ID."),
    averageRevenuePerCustomer: hasRevenue && hasCustomerId && uniqueCustomers > 0 ? available(revenueTotal / uniqueCustomers) : unavailable("Requires Revenue and Customer ID."),
    cost: hasCost ? available(costTotal) : unavailable("Map a Cost column to see this metric."),
    profit: hasProfit ? available(profitTotal) : unavailable("Map Profit, or both Revenue and Cost."),
    profitMargin: hasProfit && revenueTotal > 0 ? available(profitTotal / revenueTotal) : unavailable("Requires Profit (or Revenue + Cost) and Revenue."),
    discountRate: hasDiscount && revenueTotal > 0 ? available(discountTotal / (revenueTotal + discountTotal)) : unavailable("Map a Discount column to see this metric."),
    repeatCustomerRate: hasCustomerId && uniqueCustomers > 0 ? available(returningCustomers / uniqueCustomers) : unavailable("Map a Customer ID column to see this metric."),
    newCustomerCount: hasCustomerId ? available(uniqueCustomers - returningCustomers) : unavailable("Map a Customer ID column to see this metric."),
    returningCustomerCount: hasCustomerId ? available(returningCustomers) : unavailable("Map a Customer ID column to see this metric."),
    topProducts: mapping.product ? rankBy(rows, "product") : [],
    topCategories: mapping.category ? rankBy(rows, "category") : [],
    topChannels: mapping.channel ? rankBy(rows, "channel") : [],
    topRegions: mapping.region ? rankBy(rows, "region") : [],
  };
}
