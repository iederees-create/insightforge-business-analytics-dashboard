import type { KpiSet } from "./kpis";
import type { GeoInsights } from "./geo";
import type { QualityReport } from "../../types/domain";
import type { SegmentationResult } from "./segmentation";
import type { SentimentBreakdown } from "./sentiment";
import type { TimeSeriesPoint } from "./trends";

export interface StoryInsight {
  id: string;
  headline: string;
  detail: string;
  /** The exact figures behind the headline, shown via "Show Evidence" (Part 13). */
  evidence: string[];
}

/**
 * Deterministic Data Story Engine (Part 13). Every sentence here is derived directly
 * from already-computed metrics passed in — nothing is inferred or invented, and each
 * insight carries its evidence so a buyer can verify the claim against the dashboard.
 */
export function buildDataStory(input: {
  kpis: KpiSet;
  revenueSeries: TimeSeriesPoint[];
  quality: QualityReport;
  segmentation: SegmentationResult;
  sentiment: SentimentBreakdown;
  geo: GeoInsights;
}): StoryInsight[] {
  const insights: StoryInsight[] = [];
  const { kpis, revenueSeries, quality, segmentation, sentiment, geo } = input;

  const growthInsight = strongestGrowthPeriod(revenueSeries);
  if (growthInsight) insights.push(growthInsight);

  const declineInsight = largestDecline(revenueSeries);
  if (declineInsight) insights.push(declineInsight);

  if (kpis.topCategories.length > 0) {
    const top = kpis.topCategories[0];
    const totalRevenue = kpis.topCategories.reduce((t, c) => t + c.revenue, 0);
    const share = totalRevenue > 0 ? top.revenue / totalRevenue : 0;
    insights.push({
      id: "best-category",
      headline: `"${top.label}" is the best-performing category`,
      detail: `It generated ${formatCurrencyPlain(top.revenue)} across ${top.orders} order(s), ${(share * 100).toFixed(0)}% of category revenue.`,
      evidence: [`Category: ${top.label}`, `Revenue: ${top.revenue.toFixed(2)}`, `Orders: ${top.orders}`, `Share of category revenue: ${(share * 100).toFixed(1)}%`],
    });
  }

  if (kpis.topProducts.length > 0) {
    const totalRevenue = kpis.topProducts.reduce((t, p) => t + p.revenue, 0);
    const top = kpis.topProducts[0];
    const share = totalRevenue > 0 ? top.revenue / totalRevenue : 0;
    if (share > 0.3) {
      insights.push({
        id: "concentrated-revenue",
        headline: `Revenue is concentrated in one product`,
        detail: `"${top.label}" alone accounts for ${(share * 100).toFixed(0)}% of product revenue — a dependency worth diversifying against.`,
        evidence: [`Top product: ${top.label}`, `Revenue: ${top.revenue.toFixed(2)}`, `Share of product revenue: ${(share * 100).toFixed(1)}%`],
      });
    }
  }

  if (segmentation.available) {
    const loyal = segmentation.summaries.find((s) => s.segment === "Loyal" || s.segment === "High Value");
    if (loyal) {
      insights.push({
        id: "repeat-customers",
        headline: `${loyal.customerCount} customer(s) are in the "${loyal.segment}" segment`,
        detail: `They contribute ${(loyal.revenueShare * 100).toFixed(0)}% of segmented revenue, averaging ${loyal.averageOrderFrequency.toFixed(1)} orders each.`,
        evidence: [`Segment: ${loyal.segment}`, `Customers: ${loyal.customerCount}`, `Revenue share: ${(loyal.revenueShare * 100).toFixed(1)}%`, `Average frequency: ${loyal.averageOrderFrequency.toFixed(2)} orders`],
      });
    }
  }

  if (sentiment.available && sentiment.overTime.length >= 4) {
    const half = Math.floor(sentiment.overTime.length / 2);
    const firstHalfAvg = average(sentiment.overTime.slice(0, half).map((p) => p.averageScore));
    const secondHalfAvg = average(sentiment.overTime.slice(half).map((p) => p.averageScore));
    if (secondHalfAvg < firstHalfAvg - 0.1) {
      insights.push({
        id: "declining-sentiment",
        headline: "Review sentiment has declined recently",
        detail: `Average estimated sentiment moved from ${firstHalfAvg.toFixed(2)} to ${secondHalfAvg.toFixed(2)} (scale -1 to 1) between the first and second half of the review history.`,
        evidence: [`Earlier average sentiment: ${firstHalfAvg.toFixed(3)}`, `Recent average sentiment: ${secondHalfAvg.toFixed(3)}`, `Reviews analysed: ${sentiment.totalReviews}`],
      });
    }
  }

  if (geo.available && geo.byRegion.length >= 2) {
    const [top, second] = geo.byRegion;
    if (top.revenue > second.revenue * 1.5) {
      insights.push({
        id: "regional-difference",
        headline: `"${top.label}" outperforms other regions`,
        detail: `${top.label} generated ${formatCurrencyPlain(top.revenue)}, more than 1.5x the next-highest region ("${second.label}", ${formatCurrencyPlain(second.revenue)}).`,
        evidence: [`Top region: ${top.label} (${top.revenue.toFixed(2)})`, `Second region: ${second.label} (${second.revenue.toFixed(2)})`],
      });
    }
  }

  if (quality.score < 80) {
    const topIssue = quality.issues[0];
    insights.push({
      id: "data-quality-risk",
      headline: `Data quality score is ${quality.score}/100`,
      detail: topIssue
        ? `The largest contributor is "${topIssue.title}", affecting ${topIssue.count} row(s). Review the Data Quality Lab before trusting totals.`
        : "Review the Data Quality Lab before trusting totals.",
      evidence: quality.issues.slice(0, 3).map((i) => `${i.title}: ${i.count} row(s), severity ${i.severity}`),
    });
  }

  const missingColumns = missingColumnNote(kpis);
  if (missingColumns) insights.push(missingColumns);

  return insights;
}

function strongestGrowthPeriod(series: TimeSeriesPoint[]): StoryInsight | null {
  if (series.length < 2) return null;
  let best = { index: 1, change: -Infinity };
  for (let i = 1; i < series.length; i += 1) {
    const change = series[i].value - series[i - 1].value;
    if (change > best.change) best = { index: i, change };
  }
  if (best.change <= 0) return null;
  const point = series[best.index];
  const previous = series[best.index - 1];
  return {
    id: "strongest-growth",
    headline: "Strongest growth period identified",
    detail: `Revenue rose from ${formatCurrencyPlain(previous.value)} to ${formatCurrencyPlain(point.value)} between ${previous.date.toDateString()} and ${point.date.toDateString()}.`,
    evidence: [`Previous period value: ${previous.value.toFixed(2)}`, `Period value: ${point.value.toFixed(2)}`, `Change: +${best.change.toFixed(2)}`],
  };
}

function largestDecline(series: TimeSeriesPoint[]): StoryInsight | null {
  if (series.length < 2) return null;
  let worst = { index: 1, change: Infinity };
  for (let i = 1; i < series.length; i += 1) {
    const change = series[i].value - series[i - 1].value;
    if (change < worst.change) worst = { index: i, change };
  }
  if (worst.change >= 0) return null;
  const point = series[worst.index];
  const previous = series[worst.index - 1];
  return {
    id: "largest-decline",
    headline: "Largest decline identified",
    detail: `Revenue fell from ${formatCurrencyPlain(previous.value)} to ${formatCurrencyPlain(point.value)} between ${previous.date.toDateString()} and ${point.date.toDateString()}.`,
    evidence: [`Previous period value: ${previous.value.toFixed(2)}`, `Period value: ${point.value.toFixed(2)}`, `Change: ${worst.change.toFixed(2)}`],
  };
}

function missingColumnNote(kpis: KpiSet): StoryInsight | null {
  const unavailable = Object.entries(kpis)
    .filter(([key]) => key !== "topProducts" && key !== "topCategories" && key !== "topChannels" && key !== "topRegions")
    .filter(([, value]) => typeof value === "object" && value !== null && "available" in value && !(value as { available: boolean }).available);
  if (unavailable.length === 0) return null;
  return {
    id: "missing-information",
    headline: `${unavailable.length} metric(s) are unavailable with the current column mapping`,
    detail: "Map more columns in the Import Wizard to unlock additional KPIs and insights.",
    evidence: unavailable.map(([key, value]) => `${key}: ${(value as { unavailableReason?: string }).unavailableReason ?? "missing required column"}`),
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((t, v) => t + v, 0) / values.length : 0;
}

function formatCurrencyPlain(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
