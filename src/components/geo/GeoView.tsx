import { useMemo } from "react";
import { computeGeoInsights } from "../../lib/metrics/geo";
import type { GeoRegionSummary } from "../../lib/metrics/geo";
import { useDatasetStore } from "../../store/datasetStore";
import { formatCurrency, formatInteger } from "../../utils/format";
import { BarChart } from "../charts/BarChart";
import { Table } from "../common/Table";
import type { TableColumn } from "../common/Table";
import { EmptyState } from "../common/EmptyState";

const REGION_COLUMNS: TableColumn<GeoRegionSummary>[] = [
  { key: "label", header: "Name", render: (r) => r.label },
  { key: "revenue", header: "Revenue", render: (r) => formatCurrency(r.revenue), sortValue: (r) => r.revenue },
  { key: "orders", header: "Orders", render: (r) => formatInteger(r.orders), sortValue: (r) => r.orders },
  { key: "customerCount", header: "Customers", render: (r) => formatInteger(r.customerCount), sortValue: (r) => r.customerCount },
];

/**
 * Geographic Insights: country/region rankings as the primary view. No map tiles or external
 * services are used — a ranked table + bar chart satisfies the accessible data-table
 * requirement more safely than a half-built SVG world map would.
 */
export function GeoView() {
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const geo = useMemo(() => computeGeoInsights(mappedRows), [mappedRows]);

  if (!geo.available) {
    return <EmptyState title="Geographic insights need location data" description={geo.unavailableReason ?? "Map a Country or Region column to unlock this view."} />;
  }

  return (
    <section aria-labelledby="geo-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="geo-heading" className="text-xl font-semibold text-text">
          Geographic Insights
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Ranked by country and region rather than a map, so the data stays fully accessible and no location tiles or
          third-party map services are loaded. Coordinates, where present, are rounded to roughly 11km before
          aggregation to avoid ever plotting a single exact address.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">By country</h3>
          {geo.byCountry.length > 0 ? (
            <>
              <div className="mt-3">
                <BarChart title="Revenue by country" data={geo.byCountry.slice(0, 12).map((c) => ({ label: c.label, value: c.revenue }))} formatValue={formatCurrency} height={Math.max(180, geo.byCountry.slice(0, 12).length * 28 + 60)} />
              </div>
              <div className="mt-3">
                <Table caption="Revenue by country" columns={REGION_COLUMNS} rows={geo.byCountry} getRowId={(r) => r.label} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Map a Country column to see this breakdown.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">By region</h3>
          {geo.byRegion.length > 0 ? (
            <>
              <div className="mt-3">
                <BarChart title="Revenue by region" data={geo.byRegion.slice(0, 12).map((r) => ({ label: r.label, value: r.revenue }))} formatValue={formatCurrency} height={Math.max(180, geo.byRegion.slice(0, 12).length * 28 + 60)} />
              </div>
              <div className="mt-3">
                <Table caption="Revenue by region" columns={REGION_COLUMNS} rows={geo.byRegion} getRowId={(r) => r.label} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Map a Region column to see this breakdown.</p>
          )}
        </div>
      </div>

      {geo.points.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Location clusters</h3>
          <p className="mt-1 text-sm text-text-muted">
            {geo.points.length} distinct rounded coordinate cluster(s) found from mapped Latitude/Longitude columns. Top
            10 by revenue shown below.
          </p>
          <div className="mt-3">
            <Table
              caption="Top location clusters by revenue"
              columns={[
                { key: "coords", header: "Approximate location", render: (p) => `${p.latitude.toFixed(1)}, ${p.longitude.toFixed(1)}` },
                { key: "revenue", header: "Revenue", render: (p) => formatCurrency(p.revenue), sortValue: (p) => p.revenue },
              ]}
              rows={[...geo.points].sort((a, b) => b.revenue - a.revenue).slice(0, 10)}
              getRowId={(p) => `${p.latitude},${p.longitude}`}
            />
          </div>
        </div>
      )}
    </section>
  );
}
