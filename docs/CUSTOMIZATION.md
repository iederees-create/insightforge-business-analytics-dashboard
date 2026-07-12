# Customisation Guide

InsightForge is delivered as readable source (not a minified black box), so
you or a developer you hire can adapt it.

## Rebranding

- Colors/themes: `src/styles/globals.css` — each theme is a block of CSS
  custom properties (`--color-*`). Change the values; every component reads
  from these variables, so nothing else needs to change.
- Product name/logo: `index.html` (`<title>`) and `src/components/layout/Nav.tsx`.
- Typography: the font stack is defined once in `globals.css`.

## Adding a new column role

1. Add the role to `ColumnRole` in `src/types/domain.ts` and to
   `COLUMN_ROLES` / `COLUMN_ROLE_LABELS`.
2. Add a field to `MappedRow` and a case in `applyMapping`
   (`src/lib/csv/mapping.ts`).
3. Add keyword hints to `ROLE_KEYWORDS` in the same file for auto-detection.
4. Use the new field in whichever `src/lib/metrics/*.ts` module needs it.

## Adding a new KPI

Add a field to `KpiSet` in `src/lib/metrics/kpis.ts`, compute it inside
`computeKpis`, and follow the existing `available`/`unavailableReason`
pattern so the UI never shows a fabricated zero. Add a Vitest test alongside
the existing ones in `kpis.test.ts`.

## Adding an import template

Add an entry to `IMPORT_TEMPLATES` in `src/lib/csv/templates.ts` with the
column-role → header-name mapping for the new export format.

## Changing segmentation thresholds' defaults

Edit `DEFAULT_SEGMENTATION_THRESHOLDS` in `src/lib/metrics/segmentation.ts`.

## Removing a feature module

Each analytics view lives in its own directory under `src/components/` and
reads from the store — deleting a view and its nav entry does not affect any
other module, since none of them depend on each other directly (only on the
shared store and the calculation-engine modules).

## Build and deploy after changes

See `docs/DEPLOYMENT.md`. In short: `npm run build`, then publish the `dist/`
folder to any static host.
