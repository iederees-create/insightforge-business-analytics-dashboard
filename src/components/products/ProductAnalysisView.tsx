import { useMemo, useState } from "react";
import { computeKpis } from "../../lib/metrics/kpis";
import { buildParetoCurve, buildProductMatrix, computeConcentration, computeDiscountDependency, sortByMetric } from "../../lib/metrics/products";
import type { RankMetric } from "../../lib/metrics/products";
import { useDatasetStore } from "../../store/datasetStore";
import { formatCurrency, formatInteger, formatPercent } from "../../utils/format";
import { ParetoChart } from "../charts/ParetoChart";
import { BarChart } from "../charts/BarChart";
import { Table } from "../common/Table";
import type { TableColumn } from "../common/Table";
import { EmptyState } from "../common/EmptyState";
import { ProductMatrixChart } from "./ProductMatrixChart";
import type { RankedEntry } from "../../lib/metrics/kpis";

const METRIC_OPTIONS: { value: RankMetric; label: string; format: (v: number) => string }[] = [
  { value: "revenue", label: "Revenue", format: formatCurrency },
  { value: "quantity", label: "Quantity", format: formatInteger },
  { value: "profit", label: "Profit", format: formatCurrency },
  { value: "orders", label: "Orders", format: formatInteger },
];

function metricValue(entry: RankedEntry, metric: RankMetric): number {
  return metric === "profit" ? entry.profit ?? 0 : entry[metric];
}

/** Product Performance Explorer: rankings by selectable metric, 80/20 Pareto view, concentration, and the growth-vs-revenue matrix. */
export function ProductAnalysisView() {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [metric, setMetric] = useState<RankMetric>("revenue");

  const kpis = useMemo(() => computeKpis(mappedRows, mapping), [mappedRows, mapping]);
  const activeFormat = METRIC_OPTIONS.find((m) => m.value === metric)?.format ?? formatCurrency;

  const sorted = useMemo(() => sortByMetric(kpis.topProducts, metric), [kpis.topProducts, metric]);
  const paretoPoints = useMemo(() => buildParetoCurve(kpis.topProducts, metric), [kpis.topProducts, metric]);
  const concentration = useMemo(() => computeConcentration(kpis.topProducts, metric), [kpis.topProducts, metric]);
  const discountDependency = useMemo(() => computeDiscountDependency(mappedRows), [mappedRows]);

  const matrix = useMemo(() => {
    if (!mapping.date || mappedRows.length === 0) return null;
    const dated = mappedRows.filter((r) => r.date);
    if (dated.length < 4) return null;
    const sortedByDate = [...dated].sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
    const midpoint = Math.floor(sortedByDate.length / 2);
    const previousRows = sortedByDate.slice(0, midpoint);
    const currentRows = sortedByDate.slice(midpoint);
    const previousEntries = computeKpis(previousRows, mapping).topProducts;
    const currentEntries = computeKpis(currentRows, mapping).topProducts;
    return buildProductMatrix(currentEntries, previousEntries);
  }, [mappedRows, mapping]);

  const columns: TableColumn<RankedEntry>[] = [
    { key: "label", header: "Product", render: (r) => r.label },
    { key: "revenue", header: "Revenue", render: (r) => formatCurrency(r.revenue), sortValue: (r) => r.revenue },
    { key: "quantity", header: "Quantity", render: (r) => formatInteger(r.quantity), sortValue: (r) => r.quantity },
    { key: "profit", header: "Profit", render: (r) => (r.profit === null ? "N/A" : formatCurrency(r.profit)), sortValue: (r) => r.profit ?? 0 },
    { key: "orders", header: "Orders", render: (r) => formatInteger(r.orders), sortValue: (r) => r.orders },
  ];

  if (kpis.topProducts.length === 0) {
    return <EmptyState title="Product analysis needs a Product column" description="Map a Product column in the Import Wizard to unlock rankings, the 80/20 view, and the product matrix." />;
  }

  return (
    <section aria-labelledby="products-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="products-heading" className="text-xl font-semibold text-text">
          Product Performance Explorer
        </h2>
        <div>
          <label htmlFor="rank-metric" className="mr-2 text-sm font-medium text-text">
            Rank by
          </label>
          <select
            id="rank-metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as RankMetric)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text"
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-base font-semibold text-text">Ranking</h3>
        <div className="mt-3">
          <BarChart title={`Products ranked by ${metric}`} data={sorted.slice(0, 12).map((e) => ({ label: e.label, value: metricValue(e, metric) }))} formatValue={activeFormat} height={Math.max(200, sorted.slice(0, 12).length * 28 + 60)} />
        </div>
        <div className="mt-3">
          <Table caption="Full product ranking" columns={columns} rows={sorted} getRowId={(r) => r.label} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">80/20 (Pareto) view</h3>
          <div className="mt-3">
            <ParetoChart title={`Cumulative ${metric} share`} points={paretoPoints} formatValue={activeFormat} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Concentration summary</h3>
          {concentration ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm text-text">
              <li>
                Top product ("{concentration.topShareLabel}") is {formatPercent(concentration.top1Share)} of {metric}.
              </li>
              <li>Top 3 products are {formatPercent(concentration.top3Share)} of {metric}.</li>
              <li>
                {formatInteger(concentration.itemsForEightyPercent)} of {formatInteger(concentration.totalItems)} product(s) account for 80% of {metric}.
              </li>
              {discountDependency.available && discountDependency.discountedRevenueShare !== null && (
                <li>{formatPercent(discountDependency.discountedRevenueShare)} of revenue came from discounted orders.</li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Not enough data to compute concentration.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-base font-semibold text-text">Product matrix (revenue vs. growth)</h3>
        <p className="mt-1 text-sm text-text-muted">
          Compares the first and second half of your date range by revenue and growth rate. Requires a mapped Date
          column and enough history to split into two periods.
        </p>
        <div className="mt-3">
          {matrix ? <ProductMatrixChart points={matrix} /> : <p className="text-sm text-text-muted">Map a Date column with enough history to unlock the product matrix.</p>}
        </div>
      </div>
    </section>
  );
}
