import type { MappedRow } from "../../types/domain";
import { isValidCoordinate } from "../quality/checks";

export interface GeoRegionSummary {
  label: string;
  revenue: number;
  orders: number;
  customerCount: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  revenue: number;
}

export interface GeoInsights {
  available: boolean;
  unavailableReason?: string;
  byCountry: GeoRegionSummary[];
  byRegion: GeoRegionSummary[];
  points: GeoPoint[];
}

/** Geographic Insights module (Part 10). Aggregates by country/region and prepares point data for the map. */
export function computeGeoInsights(rows: MappedRow[]): GeoInsights {
  const hasCountryOrRegion = rows.some((r) => r.country || r.region);
  if (!hasCountryOrRegion) {
    return { available: false, unavailableReason: "Map a Country or Region column to unlock geographic insights.", byCountry: [], byRegion: [] , points: [] };
  }

  const byCountry = aggregateByLabel(rows, "country");
  const byRegion = aggregateByLabel(rows, "region");

  const points: GeoPoint[] = [];
  const pointBuckets = new Map<string, GeoPoint>();
  for (const row of rows) {
    if (!isValidCoordinate(row.latitude, row.longitude)) continue;
    // Round to ~1 decimal (~11km) to aggregate points and avoid ever plotting a single exact address (Part 10 privacy note).
    const roundedLat = Math.round((row.latitude as number) * 10) / 10;
    const roundedLng = Math.round((row.longitude as number) * 10) / 10;
    const key = `${roundedLat},${roundedLng}`;
    const bucket = pointBuckets.get(key) ?? { latitude: roundedLat, longitude: roundedLng, revenue: 0 };
    bucket.revenue += row.revenue ?? 0;
    pointBuckets.set(key, bucket);
  }
  points.push(...pointBuckets.values());

  return { available: true, byCountry, byRegion, points };
}

function aggregateByLabel(rows: MappedRow[], field: "country" | "region"): GeoRegionSummary[] {
  const groups = new Map<string, { revenue: number; orders: number; customers: Set<string> }>();
  for (const row of rows) {
    const label = row[field];
    if (!label) continue;
    const entry = groups.get(label) ?? { revenue: 0, orders: 0, customers: new Set<string>() };
    entry.revenue += row.revenue ?? 0;
    entry.orders += 1;
    if (row.customerId) entry.customers.add(row.customerId);
    groups.set(label, entry);
  }
  return [...groups.entries()]
    .map(([label, entry]) => ({ label, revenue: entry.revenue, orders: entry.orders, customerCount: entry.customers.size }))
    .sort((a, b) => b.revenue - a.revenue);
}
