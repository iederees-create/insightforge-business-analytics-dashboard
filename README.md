# InsightForge Business Analytics Studio

**Turn business data into decisions without sending it anywhere.**

A privacy-first business intelligence web app: upload a CSV of sales, customer,
or review data, map your columns, and get an interactive dashboard, customer
segmentation, sentiment insights, forecasts, a scenario planner, and
downloadable reports — entirely in your browser. No subscription, no API key,
no database, no backend, no Python required for the core product.

Live demo: https://iederees-create.github.io/insightforge-business-analytics-dashboard/

## Quick start

```bash
npm install
npm run dev       # start the dev server
npm run build      # production build to dist/
npm run test       # run the Vitest suite (calculation-engine unit tests)
```

## What's inside

- **No-code buyer experience** — guided CSV import, column mapping, and a
  synthetic demo dataset with a walkthrough tour.
- **Data Quality Lab** — missing values, duplicates, outliers, malformed
  coordinates, inconsistent labels, and more, with an explainable 0–100
  score and a non-destructive cleaned-CSV export.
- **Business Performance Dashboard** — revenue, orders, AOV, margin, repeat-
  customer rate, and rankings, with date/category/channel/region filters.
- **Customer segmentation** — configurable RFM-style segments.
- **Product & category analysis** — rankings, Pareto/80-20, concentration,
  performance matrix.
- **Geographic insights** — country/region rankings and an aggregated,
  privacy-conscious point map (no paid map API).
- **Review sentiment & topic explorer** — transparent, in-browser lexicon
  scoring (clearly labelled as an estimate, not a trained model).
- **Trends, anomalies & forecasting** — moving averages, anomaly flags, and a
  simple, explainable linear forecast with a widening uncertainty band.
- **Data Story Engine** — deterministic, evidence-backed plain-language
  insights (no external AI call).
- **Goal & Scenario Planner** — "what-if" arithmetic, clearly separated from
  historical fact.
- **Report Builder** — a print-friendly, exportable summary report.
- **Optional Python Analyst Toolkit** — notebooks for deeper analysis
  (`analyst-toolkit/`), entirely separate from the core web app.

## Documentation

See `docs/`: `ARCHITECTURE.md`, `DATA_SCHEMA.md`, `CSV_TEMPLATES.md`,
`METHODOLOGY.md`, `PRIVACY.md`, `CONFIGURATION.md`, `CUSTOMIZATION.md`,
`DEPLOYMENT.md`, `LIMITATIONS.md`, `AI_DISCLOSURE.md`, `SUPPORT.md`.

## License

See `LICENSE.txt` — a single-business commercial end-user license, not open
source.

## Privacy

Your data is processed entirely in your browser and is never uploaded. See
`docs/PRIVACY.md` for details.
