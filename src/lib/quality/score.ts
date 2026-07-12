import type { IssueSeverity, MappedRow, QualityIssue, QualityReport } from "../../types/domain";

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 1,
};

/**
 * Computes a 0-100 data-quality score. Deterministic and explainable: each issue
 * deducts (severity weight x affected-row share), capped so no single issue can
 * exceed a reasonable share of the total penalty.
 */
export function computeQualityScore(totalRows: number, issues: QualityIssue[]): number {
  if (totalRows === 0) return 100;
  let penalty = 0;
  for (const issue of issues) {
    const shareOfRows = issue.count / totalRows;
    const weighted = SEVERITY_WEIGHT[issue.severity] * shareOfRows * 10;
    penalty += Math.min(weighted, SEVERITY_WEIGHT[issue.severity]);
  }
  return Math.max(0, Math.round(100 - penalty));
}

export function buildQualityReport(rows: MappedRow[], issues: QualityIssue[]): QualityReport {
  return {
    score: computeQualityScore(rows.length, issues),
    totalRows: rows.length,
    issues: [...issues].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.count - a.count),
  };
}

export interface CleaningOptions {
  trimWhitespace: boolean;
  removeExactDuplicates: boolean;
  dropMissingDates: boolean;
  dropMissingRevenue: boolean;
  dropNegativeRevenue: boolean;
  dropNegativeQuantity: boolean;
}

export const DEFAULT_CLEANING_OPTIONS: CleaningOptions = {
  trimWhitespace: true,
  removeExactDuplicates: true,
  dropMissingDates: false,
  dropMissingRevenue: false,
  dropNegativeRevenue: false,
  dropNegativeQuantity: false,
};

export interface CleaningResult {
  cleanedRows: MappedRow[];
  removedCount: number;
  appliedSteps: string[];
}

const TEXT_FIELDS: (keyof MappedRow)[] = ["product", "category", "customerName", "channel", "region", "country", "reviewText"];

/**
 * Produces a cleaned-data preview without ever mutating the original rows array
 * (Part 6: "Never alter the original file"). Every step taken is recorded in
 * `appliedSteps` so the transformation is explained to the buyer.
 */
export function applyCleaning(rows: MappedRow[], options: CleaningOptions): CleaningResult {
  const appliedSteps: string[] = [];
  let working = rows.map((row) => ({ ...row }));

  if (options.trimWhitespace) {
    working = working.map((row) => {
      const next = { ...row };
      for (const field of TEXT_FIELDS) {
        const value = next[field];
        if (typeof value === "string") {
          (next as Record<string, unknown>)[field] = value.trim().replace(/\s{2,}/g, " ");
        }
      }
      return next;
    });
    appliedSteps.push("Trimmed leading/trailing/repeated whitespace in text fields.");
  }

  if (options.dropMissingDates) {
    const before = working.length;
    working = working.filter((row) => row.date !== null);
    if (before !== working.length) appliedSteps.push(`Removed ${before - working.length} row(s) with a missing or unparseable date.`);
  }

  if (options.dropMissingRevenue) {
    const before = working.length;
    working = working.filter((row) => row.revenue !== null);
    if (before !== working.length) appliedSteps.push(`Removed ${before - working.length} row(s) with missing revenue.`);
  }

  if (options.dropNegativeRevenue) {
    const before = working.length;
    working = working.filter((row) => row.revenue === null || row.revenue >= 0);
    if (before !== working.length) appliedSteps.push(`Removed ${before - working.length} row(s) with negative revenue.`);
  }

  if (options.dropNegativeQuantity) {
    const before = working.length;
    working = working.filter((row) => row.quantity === null || row.quantity >= 0);
    if (before !== working.length) appliedSteps.push(`Removed ${before - working.length} row(s) with negative quantity.`);
  }

  if (options.removeExactDuplicates) {
    const seen = new Set<string>();
    const before = working.length;
    working = working.filter((row) => {
      const key = JSON.stringify(row, (_k, v) => (v instanceof Date ? v.toISOString() : v));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (before !== working.length) appliedSteps.push(`Removed ${before - working.length} exact duplicate row(s).`);
  }

  return { cleanedRows: working, removedCount: rows.length - working.length, appliedSteps };
}
