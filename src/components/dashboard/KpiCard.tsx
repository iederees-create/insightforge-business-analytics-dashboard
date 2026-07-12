import type { Metric } from "../../lib/metrics/kpis";

export interface KpiCardProps {
  label: string;
  metric: Metric;
  format: (value: number) => string;
  /** Fractional change vs. the comparison period, if one is selected. */
  changeVsComparison?: number | null;
}

/** Renders a single KPI. Never shows a bare 0 for a metric the current mapping can't compute — shows the reason instead. */
export function KpiCard({ label, metric, format, changeVsComparison }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      {metric.available && metric.value !== null ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-text">{format(metric.value)}</p>
          {changeVsComparison !== undefined && changeVsComparison !== null && Number.isFinite(changeVsComparison) && (
            <p className={`mt-0.5 text-xs font-medium ${changeVsComparison >= 0 ? "text-success" : "text-danger"}`}>
              {changeVsComparison >= 0 ? "▲" : "▼"} {Math.abs(changeVsComparison * 100).toFixed(1)}% vs. comparison period
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-text-muted">Not available — {metric.unavailableReason}</p>
      )}
    </div>
  );
}
