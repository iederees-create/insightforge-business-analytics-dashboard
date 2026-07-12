# Data Schema Guide

InsightForge maps your CSV/TSV columns to a fixed set of **column roles**. You do
not need every role — the app adapts to whatever subset you provide, and clearly
explains which features are unavailable when a role is missing.

## Column roles

| Role | Type | Used by |
|---|---|---|
| `date` | date | Trends, forecasting, segmentation recency, filters |
| `orderId` | text | Order counts, duplicate-order detection |
| `transactionId` | text | Alternative order identifier |
| `customerId` | text | Segmentation, repeat-customer rate, ARPC |
| `customerName` | text | Display only; never required for calculations |
| `product` | text | Product ranking, Pareto analysis, product matrix |
| `category` | text | Category ranking, category filters |
| `quantity` | number | Units sold, unit-price outlier detection |
| `revenue` | number | Nearly every KPI — the single most load-bearing column |
| `cost` | number | Profit (if no explicit profit column), margin |
| `profit` | number | Profit, margin (used directly if present, otherwise derived from revenue − cost) |
| `discount` | number | Discount rate, discount-dependency analysis |
| `channel` | text | Channel ranking and filters |
| `region` | text | Regional ranking, geographic insights |
| `country` | text | Country ranking, geographic insights |
| `latitude` | number (-90 to 90) | Geographic point map |
| `longitude` | number (-180 to 180) | Geographic point map |
| `rating` | number | Rating-vs-sentiment comparison |
| `reviewText` | text | Sentiment and topic analysis |
| `marketingSource` | text | Campaign/source attribution (display) |
| `campaign` | text | Campaign/source attribution (display) |
| `status` | text | Display / future filtering |

## Minimum viable mapping

Only **`date`** and **`revenue`** are required to unlock the core dashboard. Every
other role adds specific features on top:

- `orderId` → exact order counts and AOV
- `customerId` → segmentation, repeat-customer rate, ARPC
- `product` / `category` → rankings and product analysis
- `country` / `region` (or `latitude` + `longitude`) → geographic insights
- `reviewText` → sentiment and topic analysis
- `cost` or `profit` → profit and margin

## Type coercion rules

- **Numbers**: currency symbols, thousands separators, and percent signs are
  stripped before parsing (`$1,234.50` → `1234.5`). A value that still isn't a
  valid number after stripping is treated as missing, not zero.
- **Dates**: parsed with the JavaScript `Date` constructor after trimming.
  Unparseable values are treated as missing and flagged in the Data Quality Lab.
- **Coordinates**: latitude must be between -90 and 90, longitude between -180
  and 180; `(0, 0)` is treated as invalid (a common "missing data" placeholder in
  real-world exports), not the Gulf of Guinea.

## Row identity

A row is a single CSV line. If your export has one line per order (not one line
per order item), quantity/revenue/profit represent the whole order on that line.
If your export is line-item level (one row per product per order), `orderId`
lets the app count distinct orders correctly even though there are more rows
than orders.
