import type { ColumnMapping, MappedRow, QualityReport } from "../../types/domain";
import type { KpiSet } from "../../lib/metrics/kpis";
import type { SegmentationResult } from "../../lib/metrics/segmentation";
import type { ForecastResult } from "../../lib/metrics/forecast";
import type { StoryInsight } from "../../lib/metrics/story";
import { escapeForDisplay } from "../../lib/csv/security";
import { formatCurrency, formatInteger, formatPercent, formatShortDate } from "../../utils/format";

export interface ReportSections {
  kpis: boolean;
  charts: boolean;
  tables: boolean;
  qualityFindings: boolean;
  insights: boolean;
  segments: boolean;
  forecast: boolean;
  scenario: boolean;
  notes: boolean;
}

export interface ReportInputs {
  fileName: string | null;
  mapping: ColumnMapping;
  mappedRows: MappedRow[];
  kpis: KpiSet;
  quality: QualityReport;
  segmentation: SegmentationResult;
  forecast: ForecastResult;
  insights: StoryInsight[];
  notesText: string;
  sections: ReportSections;
}

function esc(value: string | number): string {
  return escapeForDisplay(String(value));
}

function barRow(label: string, value: number, max: number, formatValue: (v: number) => string): string {
  const widthPct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${widthPct}%"></div></div><span class="bar-value">${esc(formatValue(value))}</span></div>`;
}

function dataDateRange(rows: MappedRow[]): string {
  const dates = rows.map((r) => r.date).filter((d): d is Date => d !== null);
  if (dates.length === 0) return "Not available (no Date column mapped)";
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  return `${formatShortDate(min)} to ${formatShortDate(max)}`;
}

function kpiSection(kpis: KpiSet): string {
  const rows: [string, string][] = [
    ["Revenue", kpis.revenue.available ? formatCurrency(kpis.revenue.value ?? 0) : `Not available (${kpis.revenue.unavailableReason ?? ""})`],
    ["Orders", kpis.orders.available ? formatInteger(kpis.orders.value ?? 0) : `Not available (${kpis.orders.unavailableReason ?? ""})`],
    ["Units sold", kpis.unitsSold.available ? formatInteger(kpis.unitsSold.value ?? 0) : `Not available (${kpis.unitsSold.unavailableReason ?? ""})`],
    ["Average order value", kpis.averageOrderValue.available ? formatCurrency(kpis.averageOrderValue.value ?? 0) : `Not available (${kpis.averageOrderValue.unavailableReason ?? ""})`],
    ["Profit", kpis.profit.available ? formatCurrency(kpis.profit.value ?? 0) : `Not available (${kpis.profit.unavailableReason ?? ""})`],
    ["Profit margin", kpis.profitMargin.available ? formatPercent(kpis.profitMargin.value ?? 0) : `Not available (${kpis.profitMargin.unavailableReason ?? ""})`],
    ["Repeat customer rate", kpis.repeatCustomerRate.available ? formatPercent(kpis.repeatCustomerRate.value ?? 0) : `Not available (${kpis.repeatCustomerRate.unavailableReason ?? ""})`],
  ];
  return `<h2>Key metrics</h2><table>${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("")}</table>`;
}

function chartsSection(kpis: KpiSet): string {
  const top = kpis.topCategories.length > 0 ? kpis.topCategories : kpis.topProducts;
  if (top.length === 0) return "";
  const max = Math.max(...top.slice(0, 8).map((e) => e.revenue));
  const title = kpis.topCategories.length > 0 ? "Top categories by revenue" : "Top products by revenue";
  return `<h2>${esc(title)}</h2><div class="bars">${top.slice(0, 8).map((e) => barRow(e.label, e.revenue, max, formatCurrency)).join("")}</div>`;
}

function tablesSection(kpis: KpiSet): string {
  const rankedTable = (title: string, entries: KpiSet["topProducts"]): string => {
    if (entries.length === 0) return "";
    return `<h3>${esc(title)}</h3><table><tr><th>Name</th><th>Revenue</th><th>Orders</th></tr>${entries
      .slice(0, 10)
      .map((e) => `<tr><td>${esc(e.label)}</td><td>${esc(formatCurrency(e.revenue))}</td><td>${esc(formatInteger(e.orders))}</td></tr>`)
      .join("")}</table>`;
  };
  return `<h2>Rankings</h2>${rankedTable("Top products", kpis.topProducts)}${rankedTable("Top categories", kpis.topCategories)}${rankedTable("Top channels", kpis.topChannels)}${rankedTable("Top regions", kpis.topRegions)}`;
}

function qualitySection(quality: QualityReport): string {
  return `<h2>Data quality</h2><p>Score: <strong>${quality.score}/100</strong> across ${formatInteger(quality.totalRows)} row(s).</p><table><tr><th>Issue</th><th>Severity</th><th>Rows affected</th></tr>${quality.issues
    .slice(0, 15)
    .map((i) => `<tr><td>${esc(i.title)}</td><td>${esc(i.severity)}</td><td>${esc(i.count)}</td></tr>`)
    .join("")}</table>`;
}

function insightsSection(insights: StoryInsight[]): string {
  if (insights.length === 0) return "";
  return `<h2>Data story insights</h2>${insights.map((i) => `<div class="insight"><h3>${esc(i.headline)}</h3><p>${esc(i.detail)}</p></div>`).join("")}`;
}

function segmentsSection(segmentation: SegmentationResult): string {
  if (!segmentation.available) return `<h2>Customer segments</h2><p>${esc(segmentation.unavailableReason ?? "Not available.")}</p>`;
  return `<h2>Customer segments</h2><p class="note">Aggregate segment summary only — no individual customer records are included in this report.</p><table><tr><th>Segment</th><th>Customers</th><th>Revenue share</th></tr>${segmentation.summaries
    .map((s) => `<tr><td>${esc(s.segment)}</td><td>${esc(formatInteger(s.customerCount))}</td><td>${esc(formatPercent(s.revenueShare))}</td></tr>`)
    .join("")}</table>`;
}

function forecastSection(forecast: ForecastResult): string {
  if (!forecast.available) return `<h2>Forecast</h2><p>${esc(forecast.unavailableReason ?? "Not available.")}</p>`;
  const nextPoint = forecast.forecast[0];
  return `<h2>Forecast</h2><p>Method: ${esc(forecast.method)}</p>${
    nextPoint ? `<p>Next period estimate: ${esc(formatCurrency(nextPoint.value))} (range ${esc(formatCurrency(nextPoint.lower))} to ${esc(formatCurrency(nextPoint.upper))})</p>` : ""
  }<p class="note">${esc(forecast.explanation)}</p>`;
}

const METHODOLOGY_NOTE = `Sentiment is estimated with a transparent keyword-scoring method, not a trained model. Segmentation uses buyer-adjustable recency/frequency/monetary thresholds and is a heuristic lens, not an objective classification. Forecasts extrapolate a linear trend from recent history with an uncertainty band that widens over time; they do not account for seasonality, promotions, or external events, and are not guarantees. All figures reflect only the columns you mapped — unmapped metrics are explicitly labeled unavailable rather than shown as zero.`;
const PRIVACY_NOTE = `This report was generated entirely in your browser; your data file was never uploaded to a server. By default this report contains aggregate figures only — no individual customer records, emails, or other row-level personal data are included.`;

export function buildReportHtml(inputs: ReportInputs): string {
  const generatedAt = new Date();
  const parts: string[] = [];
  parts.push(`<h1>InsightForge Business Analytics Report</h1>`);
  parts.push(`<p class="meta">Generated ${esc(generatedAt.toLocaleString())} · Source file: ${esc(inputs.fileName ?? "Unknown")} · Data date range: ${esc(dataDateRange(inputs.mappedRows))}</p>`);

  if (inputs.sections.kpis) parts.push(kpiSection(inputs.kpis));
  if (inputs.sections.charts) parts.push(chartsSection(inputs.kpis));
  if (inputs.sections.tables) parts.push(tablesSection(inputs.kpis));
  if (inputs.sections.qualityFindings) parts.push(qualitySection(inputs.quality));
  if (inputs.sections.insights) parts.push(insightsSection(inputs.insights));
  if (inputs.sections.segments) parts.push(segmentsSection(inputs.segmentation));
  if (inputs.sections.forecast) parts.push(forecastSection(inputs.forecast));
  if (inputs.sections.scenario) parts.push(`<h2>Scenario planning</h2><p>Scenario assumptions are configured interactively in the Scenario Planner and are intentionally excluded from this static report to avoid showing stale numbers — export them separately as JSON from that view.</p>`);
  if (inputs.sections.notes && inputs.notesText.trim()) parts.push(`<h2>Notes</h2><p>${esc(inputs.notesText)}</p>`);

  parts.push(`<h2>Methodology & limitations</h2><p class="note">${esc(METHODOLOGY_NOTE)}</p>`);
  parts.push(`<h2>Privacy</h2><p class="note">${esc(PRIVACY_NOTE)}</p>`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>InsightForge Report — ${esc(inputs.fileName ?? "Untitled")}</title>
<style>
  body { font-family: Georgia, 'Iowan Old Style', serif; color: #0f172a; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; }
  h3 { font-size: 1rem; margin-top: 1rem; }
  .meta { color: #475569; font-size: 0.85rem; }
  .note { color: #475569; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
  th, td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 0.35rem 0.5rem; }
  .bars { margin-top: 0.5rem; }
  .bar-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0; font-size: 0.85rem; }
  .bar-label { width: 9rem; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; background: #e2e8f0; height: 0.75rem; border-radius: 3px; }
  .bar-fill { background: #2563eb; height: 100%; border-radius: 3px; }
  .bar-value { width: 6rem; text-align: right; flex-shrink: 0; }
  .insight { margin-top: 0.75rem; }
  #print-button { margin-top: 1.5rem; padding: 0.5rem 1rem; }
  @media print { #print-button { display: none; } }
</style>
</head>
<body>
${parts.join("\n")}
<button id="print-button" type="button" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;
}
