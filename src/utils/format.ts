import { format as d3Format } from "d3-format";
import { format as formatDate } from "date-fns";

/**
 * Presentation-only formatting helpers shared across UI components.
 * No calculation logic lives here — every number passed in is already computed
 * by src/lib/metrics/*; these functions only decide how it is displayed.
 */

const currencyFormatter = d3Format(",.2f");
const compactCurrencyFormatter = d3Format(",.2s");
const percentFormatter = d3Format(".1%");
const integerFormatter = d3Format(",d");

export function formatCurrency(value: number): string {
  return `$${currencyFormatter(value)}`;
}

export function formatCurrencyCompact(value: number): string {
  return `$${compactCurrencyFormatter(value).replace(/G$/, "B")}`;
}

export function formatPercent(value: number): string {
  return percentFormatter(value);
}

export function formatInteger(value: number): string {
  return integerFormatter(value);
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function formatShortDate(date: Date): string {
  return formatDate(date, "MMM d, yyyy");
}

export function formatMonthDate(date: Date): string {
  return formatDate(date, "MMM yyyy");
}

export function formatAxisDate(date: Date, granularity: "day" | "week" | "month" = "day"): string {
  if (granularity === "month") return formatDate(date, "MMM ''yy");
  return formatDate(date, "MMM d");
}
