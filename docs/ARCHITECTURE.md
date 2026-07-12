# Architecture

## Summary

InsightForge is a static, client-only single-page application. There is no backend,
no database, and no server-side processing. Every calculation — CSV parsing, data
quality checks, KPIs, segmentation, sentiment, forecasting — runs in the buyer's
browser, in plain TypeScript. Uploaded data is never sent anywhere.

## Stack and why

| Choice | Why |
|---|---|
| React 19 + TypeScript + Vite | Static-build-friendly (GitHub Pages compatible), huge ecosystem, fast dev/build cycle, strong typing for a calculation-heavy codebase. |
| Zustand | A ~1KB state store for the shared dataset (raw rows, mapping, cleaned rows). Chosen over React Context to avoid re-render storms on large arrays, and over Redux because the state shape doesn't need that much ceremony (YAGNI). |
| Papa Parse | Battle-tested streaming CSV parser with built-in Web Worker mode, so a large file doesn't freeze the UI thread. MIT licensed, small. |
| Hand-written aggregation (no Arquero / DuckDB-Wasm) | The actual data operations needed (group-by, sum, rank, simple regression) are a few hundred lines of testable TypeScript. DuckDB-Wasm adds several MB of WASM and a SQL layer that buys nothing here; Arquero adds an intermediate columnar API we'd still have to wrap in typed accessors. Plain functions are easier for a buyer to read, test, and modify. |
| D3 scale/shape/array primitives (not a full chart framework) | Full control over accessibility (ARIA labels, table fallbacks, keyboard/contrast requirements) that pre-built chart libraries (Recharts, ECharts, Plotly) don't give for free, at a fraction of the bundle size. No chart-framework license terms to track. |
| Tailwind CSS v4 | Fast theming via CSS custom properties, small output with unused styles purged, easy for a buyer to reskin without learning a component library. |
| Vitest + Testing Library | Vite-native test runner (no separate config duplication), fast, same ecosystem as the build tool. |

## Data flow

```
File (CSV/TSV/JSON)
  -> parseDelimitedFile / parseJsonFile   (src/lib/csv/parse.ts)
  -> autoDetectMapping + buyer review     (src/lib/csv/mapping.ts)
  -> applyMapping -> MappedRow[]          (src/lib/csv/mapping.ts)
  -> runQualityChecks -> QualityIssue[]   (src/lib/quality/checks.ts)
  -> buildQualityReport / applyCleaning   (src/lib/quality/score.ts)
  -> computeKpis / computeSegmentation / computeGeoInsights /
     analyzeSentiment / buildTimeSeries / forecastSeries /
     buildDataStory / computeScenario      (src/lib/metrics/*.ts)
  -> React views render the results        (src/components/**)
```

State lives in a single Zustand store (`src/store/datasetStore.ts`) holding the
raw rows, the column mapping, and the mapped rows. Every calculation module is a
pure function: same input, same output, easy to unit test in isolation (see the
`*.test.ts` files next to each module).

## Why no backend

The product brief requires the core app to work without a subscription, API key,
database, backend, or Python — and to never upload the buyer's data. A static
SPA is the only architecture that satisfies all of those simultaneously. It also
means the GitHub Pages demo has zero hosting cost and no server to secure.

## Web Workers

CSV parsing runs through Papa Parse's built-in worker mode for files large enough
to matter, keeping the UI thread responsive. Heavy client-side aggregation on the
full dataset happens synchronously today because typical CSV exports (tens of
thousands of rows) complete in well under 100ms in modern JS engines; the 50MB /
250,000-row cap (`src/lib/csv/parse.ts`) keeps worst-case processing bounded. If a
buyer's dataset regularly approaches that ceiling, the aggregation functions in
`src/lib/metrics/` can be moved into a worker without changing their signatures.

## Testing

Calculation logic is unit-tested with Vitest (`src/lib/**/*.test.ts`). UI
components are integration-tested with React Testing Library where interaction
behavior matters (not for every presentational component — see
`docs/CONFIGURATION.md` for the coverage philosophy).
