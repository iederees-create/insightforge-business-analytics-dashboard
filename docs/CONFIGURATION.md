# Configuration Guide

InsightForge needs no configuration to run — there are no API keys, no
environment variables, and no external services to connect. This guide covers
the in-app settings a buyer can adjust.

## Segmentation thresholds

In the Segmentation view, adjust:
- Loyal order count (default 4)
- High Value lifetime revenue (default 500, in your data's currency unit)
- At Risk days-since-last-order (default 90)
- Inactive days-since-last-order (default 180)

Changes apply immediately and only affect how existing data is labeled — no
data is altered.

## Anomaly sensitivity

In the Trends & Forecast view, the anomaly sensitivity slider controls how many
standard deviations from the rolling mean a point must deviate to be flagged
(default 2 — lower values flag more points).

## Data cleaning options

In the Data Quality Lab, each cleaning step (trim whitespace, remove exact
duplicates, drop missing/negative values) is an independent toggle. None are
applied to the original data — they only affect the cleaned-data preview and
the downloadable cleaned CSV.

## Storage consent

Off by default. When enabled, only your column-mapping preference (not your
data) is remembered between sessions. Disable it at any time, or use
**Delete All Data** to clear everything immediately.

## Theme

Cycle between Midnight Intelligence, Light Executive, and Emerald Operations
via the theme switcher in the top navigation. The choice follows your system's
light/dark preference by default.

## Test coverage philosophy

Calculation modules (`src/lib/**`) carry unit tests because they are pure
functions with well-defined correct answers — a wrong KPI is a defect with a
knowable fix. UI components are tested where interaction logic exists (form
validation, state transitions); purely presentational components are covered
by the TypeScript compiler and manual verification rather than snapshot tests,
which tend to just encode "whatever the output currently is" rather than
"what it should be."
