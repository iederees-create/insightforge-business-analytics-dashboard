import type { ColumnMapping, MappedRow, QualityIssue } from "../../types/domain";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function issue(
  partial: Omit<QualityIssue, "id" | "count"> & { affectedRowIndexes: number[] },
): QualityIssue | null {
  if (partial.affectedRowIndexes.length === 0) return null;
  return { ...partial, id: nextId(partial.title), count: partial.affectedRowIndexes.length };
}

const KNOWN_CURRENCY_SYMBOLS = ["$", "£", "€", "R", "ZAR", "USD", "GBP", "EUR", "AUD", "CAD"];

/** Runs the full Data Quality Lab suite (Part 6) against mapped rows. Never mutates input. */
export function runQualityChecks(rows: MappedRow[], mapping: ColumnMapping): QualityIssue[] {
  const issues: (QualityIssue | null)[] = [];

  // Missing values in mapped-but-empty critical fields
  if (mapping.date) {
    const missing = rows.filter((r) => r.date === null).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Missing dates", severity: "high", column: "date", affectedRowIndexes: missing, suggestion: "Rows with an unparseable or empty date are excluded from date-based charts. Re-check the source date format." }));
  }
  if (mapping.revenue) {
    const missing = rows.filter((r) => r.revenue === null).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Missing revenue values", severity: "high", column: "revenue", affectedRowIndexes: missing, suggestion: "Rows without a revenue figure are excluded from revenue totals." }));
  }

  // Duplicate rows (all mapped fields identical)
  if (rows.length > 0) {
    const seen = new Map<string, number[]>();
    for (const row of rows) {
      const key = JSON.stringify(row, (_key, value) => (value instanceof Date ? value.toISOString() : value));
      const list = seen.get(key) ?? [];
      list.push(row.sourceIndex);
      seen.set(key, list);
    }
    const duplicateIndexes = [...seen.values()].filter((list) => list.length > 1).flatMap((list) => list.slice(1));
    issues.push(issue({ title: "Duplicate rows", severity: "medium", column: "row", affectedRowIndexes: duplicateIndexes, suggestion: "Exact duplicate rows are likely re-exports or double-counted orders. Review before including in totals." }));
  }

  // Duplicate order IDs (same order ID, different row content — not a full duplicate)
  if (mapping.orderId) {
    const byOrderId = new Map<string, number[]>();
    for (const row of rows) {
      if (!row.orderId) continue;
      const list = byOrderId.get(row.orderId) ?? [];
      list.push(row.sourceIndex);
      byOrderId.set(row.orderId, list);
    }
    const dupeOrderRows = [...byOrderId.values()].filter((list) => list.length > 1).flatMap((list) => list.slice(1));
    issues.push(issue({ title: "Duplicate order IDs", severity: "high", column: "orderId", affectedRowIndexes: dupeOrderRows, suggestion: "The same order ID appears on multiple rows. This may be legitimate (multi-line orders) or a data error — verify against the source system." }));
  }

  // Invalid / out-of-range dates
  if (mapping.date) {
    const now = new Date();
    const tooOld = new Date("1990-01-01");
    const invalid = rows.filter((r) => mapping.date && r.date === null && rowHasRawDateAttempt(r)).map((r) => r.sourceIndex);
    const outOfRange = rows.filter((r) => r.date && (r.date > now || r.date < tooOld)).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Unparseable dates", severity: "medium", column: "date", affectedRowIndexes: invalid, suggestion: "These values could not be parsed as a date and are treated as missing." }));
    issues.push(issue({ title: "Dates outside a plausible range", severity: "low", column: "date", affectedRowIndexes: outOfRange, suggestion: "Dates in the future or before 1990 are flagged for review; they are still included unless you clean them." }));
  }

  // Negative quantities / revenue
  if (mapping.quantity) {
    const negativeQty = rows.filter((r) => r.quantity !== null && r.quantity < 0).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Negative quantities", severity: "high", column: "quantity", affectedRowIndexes: negativeQty, suggestion: "Negative quantities may represent returns. Confirm whether they should be treated as refunds rather than sales." }));
  }
  if (mapping.revenue) {
    const negativeRevenue = rows.filter((r) => r.revenue !== null && r.revenue < 0).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Negative revenue", severity: "high", column: "revenue", affectedRowIndexes: negativeRevenue, suggestion: "Negative revenue may represent refunds. Consider separating refunds from gross sales." }));
  }

  // Inconsistent category / channel naming (case or whitespace variants of the same label)
  if (mapping.category) issues.push(...inconsistentLabelIssues(rows, "category", "Inconsistent category names"));
  if (mapping.channel) issues.push(...inconsistentLabelIssues(rows, "channel", "Inconsistent channel names"));

  // Whitespace problems (leading/trailing/multiple spaces) in text fields
  const textFields: (keyof MappedRow)[] = ["product", "category", "customerName", "channel", "region", "country"];
  for (const field of textFields) {
    if (!mapping[field as keyof ColumnMapping]) continue;
    const affected = rows
      .filter((r) => {
        const value = r[field];
        return typeof value === "string" && (value !== value.trim() || /\s{2,}/.test(value));
      })
      .map((r) => r.sourceIndex);
    const found = issue({ title: `Whitespace issues in ${String(field)}`, severity: "low", column: field as never, affectedRowIndexes: affected, suggestion: "Leading, trailing, or repeated spaces can split what should be one category into several. Trim during cleaning." });
    if (found) issues.push(found);
  }

  // Revenue outliers (simple IQR-based)
  if (mapping.revenue) {
    const outlierIndexes = detectOutliers(rows, "revenue");
    issues.push(issue({ title: "Revenue outliers", severity: "low", column: "revenue", affectedRowIndexes: outlierIndexes, suggestion: "Values far outside the typical range (using the interquartile-range method) are flagged for manual review, not removed automatically." }));
  }

  // Unusual unit price often indicates a currency mix or data-entry error.
  if (mapping.revenue && mapping.quantity) {
    const unitPrices = rows
      .filter((r) => r.revenue !== null && r.quantity !== null && r.quantity > 0)
      .map((r) => ({ index: r.sourceIndex, unit: (r.revenue as number) / (r.quantity as number) }));
    const unitOutliers = detectOutliersFromValues(unitPrices.map((u) => u.unit)).map((i) => unitPrices[i].index);
    issues.push(issue({ title: "Unusual unit price (possible currency mix)", severity: "low", column: "revenue", affectedRowIndexes: unitOutliers, suggestion: "Revenue divided by quantity is far from the typical unit price. This can indicate mixed currencies or a data-entry error." }));
  }

  // Incomplete customer identifiers (customerId present but customerName missing, or vice versa)
  if (mapping.customerId && mapping.customerName) {
    const incomplete = rows.filter((r) => Boolean(r.customerId) !== Boolean(r.customerName)).map((r) => r.sourceIndex);
    issues.push(issue({ title: "Incomplete customer identifiers", severity: "medium", column: "customerId", affectedRowIndexes: incomplete, suggestion: "Some rows have a customer ID without a name, or a name without an ID, which weakens repeat-customer analysis." }));
  }

  // Malformed coordinates
  if (mapping.latitude && mapping.longitude) {
    const malformed = rows
      .filter((r) => (r.latitude !== null || r.longitude !== null) && !isValidCoordinate(r.latitude, r.longitude))
      .map((r) => r.sourceIndex);
    issues.push(issue({ title: "Malformed coordinates", severity: "medium", column: "latitude", affectedRowIndexes: malformed, suggestion: "Latitude must be between -90 and 90, and longitude between -180 and 180. These rows are excluded from the map." }));
  }

  // Suspiciously repeated reviews (identical review text from different rows)
  if (mapping.reviewText) {
    const byText = new Map<string, number[]>();
    for (const row of rows) {
      const text = row.reviewText?.trim().toLowerCase();
      if (!text || text.length < 15) continue;
      const list = byText.get(text) ?? [];
      list.push(row.sourceIndex);
      byText.set(text, list);
    }
    const repeated = [...byText.values()].filter((list) => list.length > 1).flatMap((list) => list.slice(1));
    issues.push(issue({ title: "Suspiciously repeated reviews", severity: "medium", column: "reviewText", affectedRowIndexes: repeated, suggestion: "Identical review text across multiple rows may indicate templated, duplicated, or synthetic reviews. Investigate before relying on sentiment results." }));
  }

  return issues.filter((i): i is QualityIssue => i !== null);
}

function rowHasRawDateAttempt(row: MappedRow): boolean {
  // A row "attempted" a date if any other core field is populated; used to avoid flagging fully-blank rows twice.
  return Boolean(row.revenue !== null || row.orderId || row.product);
}

function inconsistentLabelIssues(rows: MappedRow[], field: "category" | "channel", title: string): QualityIssue[] {
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const value = row[field];
    if (!value) continue;
    const normalized = value.trim().toLowerCase();
    const variants = groups.get(normalized) ?? new Set<string>();
    variants.add(value);
    groups.set(normalized, variants);
  }
  const affected: number[] = [];
  for (const [normalized] of groups) {
    const variants = groups.get(normalized);
    if (variants && variants.size > 1) {
      for (const row of rows) {
        if (row[field]?.trim().toLowerCase() === normalized) affected.push(row.sourceIndex);
      }
    }
  }
  const found = issue({ title, severity: "low", column: field, affectedRowIndexes: affected, suggestion: `Multiple spellings/casings of the same ${field} (e.g. "Home" vs "home") fragment your totals. Standardise to one label per group.` });
  return found ? [found] : [];
}

function detectOutliers(rows: MappedRow[], field: "revenue" | "quantity" | "profit"): number[] {
  const values = rows.filter((r) => r[field] !== null).map((r) => ({ index: r.sourceIndex, value: r[field] as number }));
  const outlierPositions = detectOutliersFromValues(values.map((v) => v.value));
  return outlierPositions.map((i) => values[i].index);
}

/** Interquartile-range outlier detection: flags values beyond 1.5x IQR from Q1/Q3. */
export function detectOutliersFromValues(values: number[]): number[] {
  if (values.length < 4) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const indexes: number[] = [];
  values.forEach((value, i) => {
    if (value < lower || value > upper) indexes.push(i);
  });
  return indexes;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export { KNOWN_CURRENCY_SYMBOLS };
