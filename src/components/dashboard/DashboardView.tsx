import { useMemo, useState } from "react";
import { computeKpis, filterRows } from "../../lib/metrics/kpis";
import type { RankedEntry } from "../../lib/metrics/kpis";
import type { DatasetFilters } from "../../types/domain";
import { downloadCsv } from "../../lib/csv/security";
import { useDatasetStore } from "../../store/datasetStore";
import { formatCurrency, formatInteger, formatPercent } from "../../utils/format";
import { BarChart } from "../charts/BarChart";
import { Table } from "../common/Table";
import type { TableColumn } from "../common/Table";
import { Button } from "../common/Button";
import { FilterBar } from "./FilterBar";
import { KpiCard } from "./KpiCard";

const RANKED_COLUMNS: TableColumn<RankedEntry>[] = [
  { key: "label", header: "Name", render: (r) => r.label },
  { key: "revenue", header: "Revenue", render: (r) => formatCurrency(r.revenue), sortValue: (r) => r.revenue },
  { key: "quantity", header: "Units", render: (r) => formatInteger(r.quantity), sortValue: (r) => r.quantity },
  { key: "orders", header: "Orders", render: (r) => formatInteger(r.orders), sortValue: (r) => r.orders },
];

function rankedSection(title: string, entries: RankedEntry[]) {
  if (entries.length === 0) return null;
  return (
    <div key={title} className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <div className="mt-3">
        <BarChart title={`${title} by revenue`} data={entries.slice(0, 10).map((e) => ({ label: e.label, value: e.revenue }))} formatValue={formatCurrency} height={Math.max(160, entries.slice(0, 10).length * 28 + 60)} />
      </div>
      <div className="mt-3">
        <Table caption={`${title} ranking`} columns={RANKED_COLUMNS} rows={entries} getRowId={(r) => r.label} />
      </div>
    </div>
  );
}

/** Business Performance Dashboard: KPI cards, ranked breakdowns, and filters over the mapped dataset. */
export function DashboardView() {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [filters, setFilters] = useState<Partial<DatasetFilters>>({});

  const filteredRows = useMemo(() => filterRows(mappedRows, filters), [mappedRows, filters]);
  const kpis = useMemo(() => computeKpis(filteredRows, mapping), [filteredRows, mapping]);

  const comparisonKpis = useMemo(() => {
    if (!filters.comparisonRange) return null;
    const comparisonRows = filterRows(mappedRows, { ...filters, dateRange: filters.comparisonRange });
    return computeKpis(comparisonRows, mapping);
  }, [mappedRows, mapping, filters]);

  const changeFor = (current: number | null, previous: number | null | undefined): number | null => {
    if (current === null || previous === null || previous === undefined || previous === 0) return null;
    return (current - previous) / previous;
  };

  const handleExport = () => {
    const headers = ["Metric", "Value"];
    const rows: (string | number)[][] = [
      ["Revenue", kpis.revenue.available ? kpis.revenue.value ?? 0 : "N/A"],
      ["Orders", kpis.orders.available ? kpis.orders.value ?? 0 : "N/A"],
      ["Units sold", kpis.unitsSold.available ? kpis.unitsSold.value ?? 0 : "N/A"],
      ["Average order value", kpis.averageOrderValue.available ? kpis.averageOrderValue.value ?? 0 : "N/A"],
      ["Profit", kpis.profit.available ? kpis.profit.value ?? 0 : "N/A"],
      ["Profit margin", kpis.profitMargin.available ? kpis.profitMargin.value ?? 0 : "N/A"],
      ["Repeat customer rate", kpis.repeatCustomerRate.available ? kpis.repeatCustomerRate.value ?? 0 : "N/A"],
    ];
    downloadCsv("insightforge-dashboard-summary.csv", headers, rows);
  };

  return (
    <section aria-labelledby="dashboard-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="dashboard-heading" className="text-xl font-semibold text-text">
            Business Performance Dashboard
          </h2>
          <p className="text-sm text-text-muted">{filteredRows.length.toLocaleString()} row(s) match the current filters.</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          Export KPI summary CSV
        </Button>
      </div>

      <FilterBar rows={mappedRows} filters={filters} onChange={setFilters} showComparison />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenue" metric={kpis.revenue} format={formatCurrency} changeVsComparison={comparisonKpis && changeFor(kpis.revenue.value, comparisonKpis.revenue.value)} />
        <KpiCard label="Orders" metric={kpis.orders} format={formatInteger} changeVsComparison={comparisonKpis && changeFor(kpis.orders.value, comparisonKpis.orders.value)} />
        <KpiCard label="Units sold" metric={kpis.unitsSold} format={formatInteger} />
        <KpiCard label="Average order value" metric={kpis.averageOrderValue} format={formatCurrency} />
        <KpiCard label="Avg. revenue per customer" metric={kpis.averageRevenuePerCustomer} format={formatCurrency} />
        <KpiCard label="Cost" metric={kpis.cost} format={formatCurrency} />
        <KpiCard label="Profit" metric={kpis.profit} format={formatCurrency} changeVsComparison={comparisonKpis && changeFor(kpis.profit.value, comparisonKpis.profit.value)} />
        <KpiCard label="Profit margin" metric={kpis.profitMargin} format={formatPercent} />
        <KpiCard label="Discount rate" metric={kpis.discountRate} format={formatPercent} />
        <KpiCard label="Repeat customer rate" metric={kpis.repeatCustomerRate} format={formatPercent} />
        <KpiCard label="New customers" metric={kpis.newCustomerCount} format={formatInteger} />
        <KpiCard label="Returning customers" metric={kpis.returningCustomerCount} format={formatInteger} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rankedSection("Top products", kpis.topProducts)}
        {rankedSection("Top categories", kpis.topCategories)}
        {rankedSection("Top channels", kpis.topChannels)}
        {rankedSection("Top regions", kpis.topRegions)}
      </div>
    </section>
  );
}
