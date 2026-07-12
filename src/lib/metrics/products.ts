import type { MappedRow } from "../../types/domain";
import type { RankedEntry } from "./kpis";

export type RankMetric = "revenue" | "quantity" | "profit" | "orders";

export function sortByMetric(entries: RankedEntry[], metric: RankMetric): RankedEntry[] {
  return [...entries].sort((a, b) => {
    const av = metric === "profit" ? (a.profit ?? 0) : a[metric];
    const bv = metric === "profit" ? (b.profit ?? 0) : b[metric];
    return bv - av;
  });
}

export interface ParetoPoint {
  label: string;
  value: number;
  cumulativeShare: number;
}

/** 80/20 (Pareto) explorer: cumulative revenue share as products are added in ranked order (Part 9). */
export function buildParetoCurve(entries: RankedEntry[], metric: RankMetric = "revenue"): ParetoPoint[] {
  const sorted = sortByMetric(entries, metric);
  const total = sorted.reduce((t, e) => t + (metric === "profit" ? (e.profit ?? 0) : e[metric]), 0);
  if (total <= 0) return [];
  let cumulative = 0;
  return sorted.map((entry) => {
    const value = metric === "profit" ? (entry.profit ?? 0) : entry[metric];
    cumulative += value;
    return { label: entry.label, value, cumulativeShare: cumulative / total };
  });
}

export interface ConcentrationSummary {
  topShareLabel: string;
  top1Share: number;
  top3Share: number;
  /** Number of items needed to reach 80% of total, i.e. how concentrated revenue is. */
  itemsForEightyPercent: number;
  totalItems: number;
}

export function computeConcentration(entries: RankedEntry[], metric: RankMetric = "revenue"): ConcentrationSummary | null {
  const sorted = sortByMetric(entries, metric);
  if (sorted.length === 0) return null;
  const values = sorted.map((e) => (metric === "profit" ? (e.profit ?? 0) : e[metric]));
  const total = values.reduce((t, v) => t + v, 0);
  if (total <= 0) return null;

  let cumulative = 0;
  let itemsForEightyPercent = sorted.length;
  for (let i = 0; i < values.length; i += 1) {
    cumulative += values[i];
    if (cumulative / total >= 0.8) {
      itemsForEightyPercent = i + 1;
      break;
    }
  }

  const top3Total = values.slice(0, 3).reduce((t, v) => t + v, 0);
  return {
    topShareLabel: sorted[0].label,
    top1Share: values[0] / total,
    top3Share: top3Total / total,
    itemsForEightyPercent,
    totalItems: sorted.length,
  };
}

export interface ProductMatrixPoint {
  label: string;
  revenue: number;
  growthRate: number | null;
  quadrant: "star" | "steady" | "emerging" | "declining";
}

/**
 * Product performance matrix: revenue level vs period-over-period growth, split into
 * four quadrants. Requires two comparable periods; returns [] when the comparison period
 * has no data for a given product (growth shown as null and excluded from quadrant logic).
 */
export function buildProductMatrix(currentPeriod: RankedEntry[], previousPeriod: RankedEntry[]): ProductMatrixPoint[] {
  const previousByLabel = new Map(previousPeriod.map((e) => [e.label, e.revenue]));
  const medianRevenue = median(currentPeriod.map((e) => e.revenue));

  return currentPeriod.map((entry) => {
    const previousRevenue = previousByLabel.get(entry.label);
    const growthRate = previousRevenue && previousRevenue > 0 ? (entry.revenue - previousRevenue) / previousRevenue : null;
    const isHighRevenue = entry.revenue >= medianRevenue;
    const isGrowing = growthRate !== null && growthRate > 0;

    let quadrant: ProductMatrixPoint["quadrant"];
    if (isHighRevenue && isGrowing) quadrant = "star";
    else if (isHighRevenue && !isGrowing) quadrant = "steady";
    else if (!isHighRevenue && isGrowing) quadrant = "emerging";
    else quadrant = "declining";

    return { label: entry.label, revenue: entry.revenue, growthRate, quadrant };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Discount dependency: share of revenue that came from discounted orders (Part 9). */
export function computeDiscountDependency(rows: MappedRow[]): { available: boolean; discountedRevenueShare: number | null } {
  const withRevenue = rows.filter((r) => r.revenue !== null);
  const hasDiscountData = rows.some((r) => r.discount !== null);
  if (!hasDiscountData || withRevenue.length === 0) return { available: false, discountedRevenueShare: null };

  const totalRevenue = withRevenue.reduce((t, r) => t + (r.revenue ?? 0), 0);
  const discountedRevenue = withRevenue.filter((r) => (r.discount ?? 0) > 0).reduce((t, r) => t + (r.revenue ?? 0), 0);
  return { available: true, discountedRevenueShare: totalRevenue > 0 ? discountedRevenue / totalRevenue : 0 };
}
