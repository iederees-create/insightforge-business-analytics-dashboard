import { useMemo, useState } from "react";
import { buildScenarioExport, computeScenario } from "../../lib/metrics/scenario";
import type { ScenarioAssumptions } from "../../lib/metrics/scenario";
import { computeKpis } from "../../lib/metrics/kpis";
import { buildTimeSeries } from "../../lib/metrics/trends";
import { useDatasetStore } from "../../store/datasetStore";
import { formatCurrency, formatInteger, formatPercent } from "../../utils/format";
import { downloadJson } from "../../utils/download";
import { Button } from "../common/Button";

const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  targetMonthlyRevenue: 10000,
  averageOrderValue: 50,
  repeatPurchaseRateChange: 0,
  priceChangePercent: 0,
  discountChangePercent: 0,
  conversionRateChange: null,
};

function average(values: number[]): number {
  return values.length ? values.reduce((t, v) => t + v, 0) / values.length : 0;
}

/** Goal & Scenario Planner: pure what-if arithmetic on buyer-entered assumptions, clearly separated from historical fact. */
export function ScenarioPlannerView() {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);

  const kpis = useMemo(() => computeKpis(mappedRows, mapping), [mappedRows, mapping]);
  const historicalMonthlyRevenue = useMemo(() => {
    const monthly = buildTimeSeries(mappedRows, "month", "revenue");
    return average(monthly.map((p) => p.value));
  }, [mappedRows]);

  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(() => ({
    ...DEFAULT_ASSUMPTIONS,
    targetMonthlyRevenue: historicalMonthlyRevenue > 0 ? Math.round(historicalMonthlyRevenue * 1.1) : DEFAULT_ASSUMPTIONS.targetMonthlyRevenue,
    averageOrderValue: kpis.averageOrderValue.available && kpis.averageOrderValue.value ? Math.round(kpis.averageOrderValue.value) : DEFAULT_ASSUMPTIONS.averageOrderValue,
  }));

  const result = useMemo(() => computeScenario(assumptions, historicalMonthlyRevenue), [assumptions, historicalMonthlyRevenue]);

  const updateField = <K extends keyof ScenarioAssumptions>(key: K, value: ScenarioAssumptions[K]) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    downloadJson("insightforge-scenario.json", buildScenarioExport(assumptions, historicalMonthlyRevenue));
  };

  return (
    <section aria-labelledby="scenario-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="scenario-heading" className="text-xl font-semibold text-text">
          Goal & Scenario Planner
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          This is calculated arithmetic on assumptions you enter — it is not a prediction and does not use machine
          learning. Treat every number below as "if these assumptions hold" math, not a forecast.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Your historical data</h3>
        <p className="mt-1 text-lg text-text">
          {historicalMonthlyRevenue > 0 ? formatCurrency(historicalMonthlyRevenue) : "N/A"} average monthly revenue
        </p>
        {historicalMonthlyRevenue === 0 && <p className="text-xs text-text-muted">Map Date and Revenue columns to compute this baseline.</p>}
      </div>

      <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-text">Your assumptions</legend>

        <div>
          <label htmlFor="target-revenue" className="text-sm font-medium text-text">
            Target monthly revenue
          </label>
          <input id="target-revenue" type="number" min={0} value={assumptions.targetMonthlyRevenue} onChange={(e) => updateField("targetMonthlyRevenue", Number(e.target.value) || 0)} className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text" />
        </div>
        <div>
          <label htmlFor="aov" className="text-sm font-medium text-text">
            Assumed average order value
          </label>
          <input id="aov" type="number" min={0} value={assumptions.averageOrderValue} onChange={(e) => updateField("averageOrderValue", Number(e.target.value) || 0)} className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text" />
        </div>
        <div>
          <label htmlFor="repeat-change" className="text-sm font-medium text-text">
            Repeat purchase rate change (points)
          </label>
          <input id="repeat-change" type="number" step={1} value={assumptions.repeatPurchaseRateChange * 100} onChange={(e) => updateField("repeatPurchaseRateChange", (Number(e.target.value) || 0) / 100)} className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text" />
        </div>
        <div>
          <label htmlFor="price-change" className="text-sm font-medium text-text">
            Price change (%)
          </label>
          <input id="price-change" type="number" step={1} value={assumptions.priceChangePercent * 100} onChange={(e) => updateField("priceChangePercent", (Number(e.target.value) || 0) / 100)} className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text" />
        </div>
        <div>
          <label htmlFor="discount-change" className="text-sm font-medium text-text">
            Discount change (%, positive = less discounting)
          </label>
          <input id="discount-change" type="number" step={1} value={assumptions.discountChangePercent * 100} onChange={(e) => updateField("discountChangePercent", (Number(e.target.value) || 0) / 100)} className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text" />
        </div>
        <div>
          <label htmlFor="conversion-change" className="text-sm font-medium text-text">
            Conversion rate change (%, optional)
          </label>
          <input
            id="conversion-change"
            type="number"
            step={1}
            value={assumptions.conversionRateChange === null ? "" : assumptions.conversionRateChange * 100}
            onChange={(e) => updateField("conversionRateChange", e.target.value === "" ? null : Number(e.target.value) / 100)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            placeholder="Leave blank if unknown"
          />
        </div>
      </fieldset>

      <div className="rounded-lg border border-accent bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Calculated scenario</h3>
          <Button variant="secondary" onClick={handleExport}>
            Export scenario JSON
          </Button>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-text">
          <li>Orders needed to hit target: {formatInteger(result.requiredOrders)}</li>
          <li>Implied average order value: {formatCurrency(result.requiredAverageOrderValue)}</li>
          <li>Revenue if price change applied to historical baseline: {formatCurrency(result.projectedRevenueFromPriceChange)}</li>
          <li>Revenue if discount change applied to historical baseline: {formatCurrency(result.projectedRevenueFromDiscountChange)}</li>
        </ul>
        <ul className="mt-3 list-disc pl-5 text-xs text-text-muted">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
      {assumptions.repeatPurchaseRateChange !== 0 && (
        <p className="text-xs text-text-muted">Current repeat customer rate: {kpis.repeatCustomerRate.available ? formatPercent(kpis.repeatCustomerRate.value ?? 0) : "not available — map a Customer ID column"}.</p>
      )}
    </section>
  );
}
