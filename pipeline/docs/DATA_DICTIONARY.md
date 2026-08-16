# Data Dictionary

Every field, stage by stage. Where a field has a direct TypeScript
counterpart in the browser app, it's named explicitly so "compatible with
the dashboard" is checkable line-by-line.

## Raw inputs (`sample_data/*.csv`, synthetic)

### `sales.csv` (required: `date`, `orderId`, `revenue`)

| Column | Type | ColumnRole equivalent (`src/types/domain.ts`) |
|---|---|---|
| date | date | `date` |
| orderId | string | `orderId` |
| transactionId | string | `transactionId` |
| customerId | string | `customerId` |
| product | string | `product` |
| category | string | `category` |
| quantity | integer | `quantity` |
| revenue | number | `revenue` |
| cost | number | `cost` |
| profit | number | `profit` |
| discount | number | `discount` |
| channel | string | `channel` |
| region | string | `region` |
| country | string | `country` |
| marketingSource | string | `marketingSource` |
| campaign | string | `campaign` |
| status | string | `status` |

### `customers.csv` (required: `customerId`)

| Column | Type | Notes |
|---|---|---|
| customerId | string | join key |
| customerName | string | `customerName` role |
| region / country | string | `region` / `country` roles |
| latitude / longitude | number | `latitude` / `longitude` roles; `(0,0)` treated as a missing-data placeholder, matching `docs/DATA_SCHEMA.md` |
| signupDate | date | pipeline-internal only, not a `ColumnRole` |

### `reviews.csv` (required: `rating`)

| Column | Type | Notes |
|---|---|---|
| date, orderId, customerId, product | - | join/context fields |
| rating | integer | `rating` role |
| reviewText | string | `reviewText` role |

## Stage outputs (`output/{logical_date}/`)

| File | Produced by | Contents |
|---|---|---|
| `00_manifest.json` | discover_inputs | file paths, row counts, sha256 |
| `01_validation_report.json` | validate_schema | per-file missing-column/missing-value/type-violation counts |
| `02_cleaned_*.csv` | clean_and_deduplicate | standardised, deduplicated per-dataset CSVs |
| `02_dedupe_report.json` | clean_and_deduplicate | exact duplicates removed, duplicate order IDs (flagged not removed), category labels standardised |
| `03_joined_dataset.csv` | join_datasets | sales enriched with customer + review-aggregate columns |
| `03_join_summary.json` | join_datasets | row count, unmatched-customer count |
| `04_metrics.json` | calculate_metrics | full `kpis` + `segmentation` objects (see below) |
| `05_dashboard_export.csv` / `.json` | export_dashboard_data | dashboard-ready output |
| `06_quality_report.json` / `.md` | generate_quality_report | full issue list + score |
| `_SUCCESS` | generate_quality_report | run-complete marker |

## `04_metrics.json` -> dashboard TS types

`kpis` mirrors `KpiSet` (`src/lib/metrics/kpis.ts`): `revenue`, `orders`,
`unitsSold`, `averageOrderValue`, `averageRevenuePerCustomer`, `cost`,
`profit`, `profitMargin`, `discountRate`, `repeatCustomerRate`,
`newCustomerCount`, `returningCustomerCount`, `topProducts`,
`topCategories`, `topChannels`, `topRegions` (each a list of
`{label, revenue, quantity, profit, orders}`, matching `RankedEntry`).

`segmentation` mirrors `SegmentationResult`
(`src/lib/metrics/segmentation.ts`): `available`, `asOfDate`, `customers`
(`{customerId, recencyDays, frequency, monetary, segment}`, matching
`CustomerSegmentRow`), `summaries` (`{segment, customerCount,
revenueShare, averageOrderFrequency, averageRecencyDays}`, matching
`SegmentSummary`). Segment thresholds are identical constants:
`loyalOrderCount=4`, `highValueRevenue=500`, `atRiskDays=90`,
`inactiveDays=180`.

## `06_quality_report.json` -> dashboard TS types

Mirrors `QualityReport`/`QualityIssue` (`src/types/domain.ts`):
`score` (0-100), `totalRowsAcrossInputs`, `issues` (each with `id`,
`title`, `severity` in `critical|high|medium|low`, `count`, `suggestion`).
Severity weights (`critical=25, high=12, medium=5, low=1`) and the scoring
formula match `src/lib/quality/score.ts`'s `computeQualityScore` exactly.

## `05_dashboard_export.csv` headers

Exactly the labels in `COLUMN_ROLE_LABELS` (`src/types/domain.ts`) - "Date",
"Order ID", "Transaction ID", "Customer ID", "Customer name", "Product",
"Category", "Quantity", "Revenue", "Cost", "Profit", "Discount", "Channel",
"Region", "Country", "Rating" - so `src/lib/csv/mapping.ts`'s
`autoDetectMapping()` keyword-matches every one of them automatically.
