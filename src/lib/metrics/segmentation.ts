import type { MappedRow } from "../../types/domain";

export type SegmentLabel = "New" | "Repeat" | "Loyal" | "High Value" | "At Risk" | "Inactive";

export interface CustomerSegmentRow {
  customerId: string;
  customerName: string | null;
  recencyDays: number;
  frequency: number;
  monetary: number;
  segment: SegmentLabel;
}

export interface SegmentSummary {
  segment: SegmentLabel;
  customerCount: number;
  revenueShare: number;
  averageOrderFrequency: number;
  averageRecencyDays: number;
}

export interface SegmentationThresholds {
  /** Orders at or above this count are "Loyal" (frequency-qualified). */
  loyalOrderCount: number;
  /** Lifetime revenue at or above this amount qualifies "High Value" regardless of frequency. */
  highValueRevenue: number;
  /** Days since last order at or beyond this is "At Risk". */
  atRiskDays: number;
  /** Days since last order at or beyond this is "Inactive" (supersedes At Risk). */
  inactiveDays: number;
}

export const DEFAULT_SEGMENTATION_THRESHOLDS: SegmentationThresholds = {
  loyalOrderCount: 4,
  highValueRevenue: 500,
  atRiskDays: 90,
  inactiveDays: 180,
};

export interface SegmentationResult {
  available: boolean;
  unavailableReason?: string;
  asOfDate: Date | null;
  customers: CustomerSegmentRow[];
  summaries: SegmentSummary[];
}

/**
 * RFM-style customer segmentation (Part 8). Requires customerId + date + revenue.
 * Thresholds are explicit and buyer-configurable — this is a heuristic lens on the
 * data, not an objective classification, and the UI must say so.
 */
export function computeSegmentation(
  rows: MappedRow[],
  thresholds: SegmentationThresholds = DEFAULT_SEGMENTATION_THRESHOLDS,
): SegmentationResult {
  const eligible = rows.filter((r) => r.customerId && r.date);
  if (eligible.length === 0) {
    return {
      available: false,
      unavailableReason: "Segmentation requires both a Customer ID column and a Date column.",
      asOfDate: null,
      customers: [],
      summaries: [],
    };
  }

  const asOfDate = eligible.reduce((latest, r) => (r.date! > latest ? r.date! : latest), eligible[0].date!);

  const byCustomer = new Map<string, MappedRow[]>();
  for (const row of eligible) {
    const list = byCustomer.get(row.customerId!) ?? [];
    list.push(row);
    byCustomer.set(row.customerId!, list);
  }

  const customers: CustomerSegmentRow[] = [];
  for (const [customerId, customerRows] of byCustomer) {
    const frequency = customerRows.length;
    const monetary = customerRows.reduce((total, r) => total + (r.revenue ?? 0), 0);
    const lastOrderDate = customerRows.reduce((latest, r) => (r.date! > latest ? r.date! : latest), customerRows[0].date!);
    const recencyDays = Math.round((asOfDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

    customers.push({
      customerId,
      customerName: customerRows.find((r) => r.customerName)?.customerName ?? null,
      recencyDays,
      frequency,
      monetary,
      segment: classifySegment(frequency, monetary, recencyDays, thresholds),
    });
  }

  const summaries = summarizeSegments(customers);
  return { available: true, asOfDate, customers, summaries };
}

function classifySegment(
  frequency: number,
  monetary: number,
  recencyDays: number,
  thresholds: SegmentationThresholds,
): SegmentLabel {
  if (recencyDays >= thresholds.inactiveDays) return "Inactive";
  if (monetary >= thresholds.highValueRevenue) return "High Value";
  if (recencyDays >= thresholds.atRiskDays) return "At Risk";
  if (frequency >= thresholds.loyalOrderCount) return "Loyal";
  if (frequency > 1) return "Repeat";
  return "New";
}

function summarizeSegments(customers: CustomerSegmentRow[]): SegmentSummary[] {
  const totalRevenue = customers.reduce((total, c) => total + c.monetary, 0);
  const groups = new Map<SegmentLabel, CustomerSegmentRow[]>();
  for (const customer of customers) {
    const list = groups.get(customer.segment) ?? [];
    list.push(customer);
    groups.set(customer.segment, list);
  }

  return [...groups.entries()]
    .map(([segment, list]) => ({
      segment,
      customerCount: list.length,
      revenueShare: totalRevenue > 0 ? list.reduce((total, c) => total + c.monetary, 0) / totalRevenue : 0,
      averageOrderFrequency: list.reduce((total, c) => total + c.frequency, 0) / list.length,
      averageRecencyDays: list.reduce((total, c) => total + c.recencyDays, 0) / list.length,
    }))
    .sort((a, b) => b.customerCount - a.customerCount);
}
