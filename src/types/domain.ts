export type ColumnRole =
  | "date"
  | "orderId"
  | "transactionId"
  | "customerId"
  | "customerName"
  | "product"
  | "category"
  | "quantity"
  | "revenue"
  | "cost"
  | "profit"
  | "discount"
  | "channel"
  | "region"
  | "country"
  | "latitude"
  | "longitude"
  | "rating"
  | "reviewText"
  | "marketingSource"
  | "campaign"
  | "status";

export const COLUMN_ROLES: ColumnRole[] = [
  "date",
  "orderId",
  "transactionId",
  "customerId",
  "customerName",
  "product",
  "category",
  "quantity",
  "revenue",
  "cost",
  "profit",
  "discount",
  "channel",
  "region",
  "country",
  "latitude",
  "longitude",
  "rating",
  "reviewText",
  "marketingSource",
  "campaign",
  "status",
];

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  date: "Date",
  orderId: "Order ID",
  transactionId: "Transaction ID",
  customerId: "Customer ID",
  customerName: "Customer name",
  product: "Product",
  category: "Category",
  quantity: "Quantity",
  revenue: "Revenue",
  cost: "Cost",
  profit: "Profit",
  discount: "Discount",
  channel: "Channel",
  region: "Region",
  country: "Country",
  latitude: "Latitude",
  longitude: "Longitude",
  rating: "Rating",
  reviewText: "Review text",
  marketingSource: "Marketing source",
  campaign: "Campaign",
  status: "Status",
};

export type InferredType = "string" | "number" | "date" | "boolean";

/** Maps a ColumnRole to the source CSV header it was mapped from, or null if unmapped. */
export type ColumnMapping = Partial<Record<ColumnRole, string>>;

/** A single raw row as parsed from CSV/TSV/JSON, keyed by original header. */
export type RawRow = Record<string, string>;

/** A row after mapping to canonical roles and coercion to typed values. */
export interface MappedRow {
  date: Date | null;
  orderId: string | null;
  transactionId: string | null;
  customerId: string | null;
  customerName: string | null;
  product: string | null;
  category: string | null;
  quantity: number | null;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  discount: number | null;
  channel: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewText: string | null;
  marketingSource: string | null;
  campaign: string | null;
  status: string | null;
  /** Index into the original raw row array, used to trace issues back to source. */
  sourceIndex: number;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  mapping: ColumnMapping;
}

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface QualityIssue {
  id: string;
  title: string;
  severity: IssueSeverity;
  column: ColumnRole | "row";
  count: number;
  affectedRowIndexes: number[];
  suggestion: string;
}

export interface QualityReport {
  score: number;
  totalRows: number;
  issues: QualityIssue[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DatasetFilters {
  dateRange: DateRange | null;
  comparisonRange: DateRange | null;
  categories: string[];
  products: string[];
  channels: string[];
  regions: string[];
}
