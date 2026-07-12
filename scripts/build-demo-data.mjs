// Builds public/sample-data/synthetic-demo-orders.csv by joining the Python
// Analyst Toolkit's already-generated synthetic CSVs (analyst-toolkit/sample_data/)
// into one flat file matching the web app's column-role schema. This keeps a
// single source of truth for synthetic demo data instead of maintaining two
// independent generators. Run with: node scripts/build-demo-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Papa from "papaparse";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkitData = path.join(root, "analyst-toolkit", "sample_data");
const outDir = path.join(root, "public", "sample-data");

function parseCsv(filePath) {
  // Skip the leading "# SYNTHETIC DATA" comment line the generator writes.
  const raw = readFileSync(filePath, "utf8");
  const withoutComment = raw.replace(/^#.*\n#.*\n/, "");
  return Papa.parse(withoutComment, { header: true, skipEmptyLines: true }).data;
}

const orders = parseCsv(path.join(toolkitData, "orders.csv"));
const customers = parseCsv(path.join(toolkitData, "customers.csv"));
const reviews = parseCsv(path.join(toolkitData, "reviews.csv"));

const customerById = new Map(customers.map((c) => [c.customerId, c]));
const reviewByOrderId = new Map(reviews.map((r) => [r.orderId, r]));

const HEADERS = [
  "date", "orderId", "transactionId", "customerId", "customerName", "product",
  "category", "quantity", "revenue", "cost", "profit", "discount", "channel",
  "region", "country", "latitude", "longitude", "rating", "reviewText",
  "marketingSource", "campaign", "status",
];

const rows = orders.map((order) => {
  const customer = customerById.get(order.customerId);
  const review = reviewByOrderId.get(order.orderId);
  return HEADERS.map((h) => {
    if (h === "latitude") return customer?.latitude ?? "";
    if (h === "longitude") return customer?.longitude ?? "";
    if (h === "rating") return review?.rating ?? "";
    if (h === "reviewText") return review?.reviewText ?? "";
    return order[h] ?? "";
  });
});

mkdirSync(outDir, { recursive: true });
const csv = Papa.unparse({ fields: HEADERS, data: rows });
writeFileSync(path.join(outDir, "synthetic-demo-orders.csv"), csv + "\n", "utf8");

console.log(`Wrote ${rows.length} rows to public/sample-data/synthetic-demo-orders.csv`);
