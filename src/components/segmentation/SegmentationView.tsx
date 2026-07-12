import { useMemo, useState } from "react";
import { computeSegmentation, DEFAULT_SEGMENTATION_THRESHOLDS } from "../../lib/metrics/segmentation";
import type { CustomerSegmentRow, SegmentationThresholds } from "../../lib/metrics/segmentation";
import { downloadCsv } from "../../lib/csv/security";
import { useDatasetStore } from "../../store/datasetStore";
import { formatCurrency, formatInteger, formatPercent } from "../../utils/format";
import { DonutChart } from "../charts/DonutChart";
import { Table } from "../common/Table";
import type { TableColumn } from "../common/Table";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";

const THRESHOLD_FIELDS: { key: keyof SegmentationThresholds; label: string; help: string }[] = [
  { key: "loyalOrderCount", label: "Loyal: minimum orders", help: "Customers with at least this many orders are \"Loyal\"." },
  { key: "highValueRevenue", label: "High Value: minimum lifetime revenue", help: "Customers spending at least this much are \"High Value\", regardless of order count." },
  { key: "atRiskDays", label: "At Risk: days since last order", help: "Customers silent for at least this many days are flagged \"At Risk\"." },
  { key: "inactiveDays", label: "Inactive: days since last order", help: "Customers silent for at least this many days are \"Inactive\" (overrides At Risk)." },
];

const CUSTOMER_COLUMNS: TableColumn<CustomerSegmentRow>[] = [
  { key: "customerId", header: "Customer ID", render: (r) => r.customerId },
  { key: "segment", header: "Segment", render: (r) => r.segment },
  { key: "recencyDays", header: "Recency (days)", render: (r) => formatInteger(r.recencyDays), sortValue: (r) => r.recencyDays },
  { key: "frequency", header: "Frequency (orders)", render: (r) => formatInteger(r.frequency), sortValue: (r) => r.frequency },
  { key: "monetary", header: "Monetary", render: (r) => formatCurrency(r.monetary), sortValue: (r) => r.monetary },
];

/** RFM-style customer segmentation with buyer-configurable thresholds. Explicitly framed as a heuristic lens, not ground truth. */
export function SegmentationView() {
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [thresholds, setThresholds] = useState<SegmentationThresholds>(DEFAULT_SEGMENTATION_THRESHOLDS);

  const result = useMemo(() => computeSegmentation(mappedRows, thresholds), [mappedRows, thresholds]);

  const handleExport = () => {
    // Only customerId/segment/recency/frequency/monetary are exported — never arbitrary raw customer fields.
    downloadCsv(
      "insightforge-customer-segments.csv",
      ["Customer ID", "Segment", "Recency (days)", "Frequency (orders)", "Monetary"],
      result.customers.map((c) => [c.customerId, c.segment, c.recencyDays, c.frequency, c.monetary]),
    );
  };

  if (!result.available) {
    return (
      <EmptyState
        title="Segmentation needs more columns"
        description={result.unavailableReason ?? "Map a Customer ID and Date column to unlock segmentation."}
      />
    );
  }

  return (
    <section aria-labelledby="segmentation-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="segmentation-heading" className="text-xl font-semibold text-text">
          Customer Segmentation
        </h2>
        <p className="mt-1 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
          This segmentation is a heuristic lens based on recency, frequency, and monetary value with thresholds you can
          adjust below — it is not an objective classification of your customers. Treat it as a starting point for
          investigation, not a final verdict.
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-text">Segmentation thresholds</legend>
        {THRESHOLD_FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={`threshold-${field.key}`} className="text-sm font-medium text-text">
              {field.label}
            </label>
            <input
              id={`threshold-${field.key}`}
              type="number"
              min={0}
              value={thresholds[field.key]}
              onChange={(event) =>
                setThresholds((prev) => ({ ...prev, [field.key]: Number(event.target.value) || 0 }))
              }
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            />
            <p className="mt-0.5 text-xs text-text-muted">{field.help}</p>
          </div>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Segment mix</h3>
          <div className="mt-3">
            <DonutChart title="Customers by segment" data={result.summaries.map((s) => ({ label: s.segment, value: s.customerCount }))} formatValue={formatInteger} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Segment summary</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {result.summaries.map((s) => (
              <li key={s.segment} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="font-medium text-text">{s.segment}</span>
                <span className="text-text-muted">
                  {formatInteger(s.customerCount)} customer(s), {formatPercent(s.revenueShare)} of revenue, avg {s.averageOrderFrequency.toFixed(1)} orders
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">Customers</h3>
          <Button variant="secondary" onClick={handleExport}>
            Export segment table CSV
          </Button>
        </div>
        <div className="mt-3">
          <Table caption="Per-customer segmentation" columns={CUSTOMER_COLUMNS} rows={result.customers} getRowId={(r) => r.customerId} />
        </div>
      </div>
    </section>
  );
}
