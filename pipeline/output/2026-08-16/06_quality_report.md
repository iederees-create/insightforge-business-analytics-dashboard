# InsightForge Pipeline - Data Quality Report

**Logical date:** 2026-08-16  
**Overall quality score:** 92/100  
**Total input rows:** 2163  
**Joined dataset rows:** 1506  
**Dashboard export rows:** 1506  

## KPI summary

- Revenue: 289656.41
- Orders: 1500
- Profit margin: 0.5313
- Unique customers: 394
- Top product: Scented Soy Candle

## Data quality issues (8)

| Severity | Issue | Count | Suggestion |
|---|---|---|---|
| high | Duplicate order IDs with differing row content in reviews.csv | 20 | Flagged for manual review, not auto-removed - may be legitimate multi-line orders. See 02_dedupe_report.json for the affected order IDs. |
| high | Missing values in sales.revenue | 16 | Rows with a blank revenue in sales.csv are excluded from calculations that depend on it. |
| high | Duplicate order IDs with differing row content in sales.csv | 6 | Flagged for manual review, not auto-removed - may be legitimate multi-line orders. See 02_dedupe_report.json for the affected order IDs. |
| high | Missing values in sales.date | 2 | Rows with a blank date in sales.csv are excluded from calculations that depend on it. |
| medium | Missing values in sales.campaign | 371 | Rows with a blank campaign in sales.csv are excluded from calculations that depend on it. |
| medium | Sales rows referencing a customer not present in customers.csv | 33 | These sales rows still appear in the joined dataset but have no matching customer profile - verify customers.csv is complete. |
| medium | Exact duplicate rows removed from sales.csv | 7 | Exact duplicate rows were detected and removed automatically during cleaning. |
| medium | Unparseable date values in sales.date | 4 | These date values in sales.csv could not be parsed and are treated as missing, not zero. |
