import type { ColumnMapping, ColumnRole, InferredType, MappedRow, RawRow } from "../../types/domain";
import { COLUMN_ROLES } from "../../types/domain";

const ROLE_KEYWORDS: Record<ColumnRole, string[]> = {
  date: ["date", "order date", "purchase date", "created", "timestamp"],
  orderId: ["order id", "order_id", "orderid", "order no", "order number"],
  transactionId: ["transaction id", "transaction_id", "txn id", "txn_id"],
  customerId: ["customer id", "customer_id", "buyer id", "client id"],
  customerName: ["customer name", "buyer name", "client name", "name"],
  product: ["product", "item", "sku name", "listing title", "title"],
  category: ["category", "product category", "type"],
  quantity: ["quantity", "qty", "units"],
  revenue: ["revenue", "sales", "total", "amount", "price", "order total"],
  cost: ["cost", "cogs", "unit cost"],
  profit: ["profit", "margin amount", "net"],
  discount: ["discount", "coupon", "promo"],
  channel: ["channel", "sales channel", "platform"],
  region: ["region", "state", "province"],
  country: ["country", "nation"],
  latitude: ["lat", "latitude"],
  longitude: ["lng", "lon", "longitude"],
  rating: ["rating", "stars", "score"],
  reviewText: ["review", "review text", "comment", "feedback"],
  marketingSource: ["source", "utm source", "marketing source", "referrer"],
  campaign: ["campaign", "utm campaign", "ad campaign"],
  status: ["status", "order status", "fulfillment status"],
};

function normalize(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Suggests a ColumnRole -> header mapping by scoring header names against keyword lists. */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  for (const role of COLUMN_ROLES) {
    const keywords = ROLE_KEYWORDS[role];
    let best: { header: string; score: number } | null = null;

    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const normalized = normalize(header);
      let score = 0;
      for (const keyword of keywords) {
        if (normalized === keyword) score = Math.max(score, 100);
        else if (normalized.includes(keyword)) score = Math.max(score, 60);
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { header, score };
      }
    }

    if (best) {
      mapping[role] = best.header;
      usedHeaders.add(best.header);
    }
  }

  return mapping;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\d{1,2}-\d{1,2}-\d{2,4}/;
const NUMBER_PATTERN = /^-?[\d,]+(\.\d+)?$/;

/** Infers the likely data type of a column by sampling non-empty values. */
export function inferColumnType(rows: RawRow[], header: string, sampleSize = 50): InferredType {
  const samples = rows
    .slice(0, sampleSize)
    .map((row) => row[header])
    .filter((value): value is string => Boolean(value && value.trim()));

  if (samples.length === 0) return "string";

  const numberLike = samples.filter((v) => NUMBER_PATTERN.test(v.trim())).length;
  if (numberLike / samples.length > 0.8) return "number";

  const dateLike = samples.filter((v) => DATE_PATTERN.test(v.trim()) && !Number.isNaN(Date.parse(v))).length;
  if (dateLike / samples.length > 0.8) return "date";

  const booleanLike = samples.filter((v) => ["true", "false", "yes", "no"].includes(v.trim().toLowerCase())).length;
  if (booleanLike / samples.length > 0.8) return "boolean";

  return "string";
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,$£€%\s]/g, "").trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Applies a ColumnMapping to raw rows, producing typed MappedRow values. */
export function applyMapping(rows: RawRow[], mapping: ColumnMapping): MappedRow[] {
  return rows.map((row, sourceIndex) => ({
    date: parseDateValue(mapping.date ? row[mapping.date] : undefined),
    orderId: parseString(mapping.orderId ? row[mapping.orderId] : undefined),
    transactionId: parseString(mapping.transactionId ? row[mapping.transactionId] : undefined),
    customerId: parseString(mapping.customerId ? row[mapping.customerId] : undefined),
    customerName: parseString(mapping.customerName ? row[mapping.customerName] : undefined),
    product: parseString(mapping.product ? row[mapping.product] : undefined),
    category: parseString(mapping.category ? row[mapping.category] : undefined),
    quantity: parseNumber(mapping.quantity ? row[mapping.quantity] : undefined),
    revenue: parseNumber(mapping.revenue ? row[mapping.revenue] : undefined),
    cost: parseNumber(mapping.cost ? row[mapping.cost] : undefined),
    profit: parseNumber(mapping.profit ? row[mapping.profit] : undefined),
    discount: parseNumber(mapping.discount ? row[mapping.discount] : undefined),
    channel: parseString(mapping.channel ? row[mapping.channel] : undefined),
    region: parseString(mapping.region ? row[mapping.region] : undefined),
    country: parseString(mapping.country ? row[mapping.country] : undefined),
    latitude: parseNumber(mapping.latitude ? row[mapping.latitude] : undefined),
    longitude: parseNumber(mapping.longitude ? row[mapping.longitude] : undefined),
    rating: parseNumber(mapping.rating ? row[mapping.rating] : undefined),
    reviewText: parseString(mapping.reviewText ? row[mapping.reviewText] : undefined),
    marketingSource: parseString(mapping.marketingSource ? row[mapping.marketingSource] : undefined),
    campaign: parseString(mapping.campaign ? row[mapping.campaign] : undefined),
    status: parseString(mapping.status ? row[mapping.status] : undefined),
    sourceIndex,
  }));
}

/** Roles required for at least a minimally useful dashboard (Part 5: "must work with a useful subset"). */
export const MINIMUM_VIABLE_ROLES: ColumnRole[] = ["date", "revenue"];

export function hasMinimumViableMapping(mapping: ColumnMapping): boolean {
  return MINIMUM_VIABLE_ROLES.every((role) => Boolean(mapping[role]));
}
