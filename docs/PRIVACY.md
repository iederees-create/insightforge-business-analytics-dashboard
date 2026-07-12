# Privacy

## The short version

Your data never leaves your browser. InsightForge has no backend, no server, and
makes no network requests with your uploaded data.

## What happens when you upload a file

1. The file is read directly by your browser (via the File API).
2. It is parsed in memory (optionally inside a Web Worker, still on your device).
3. All calculations run locally in JavaScript.
4. Nothing is transmitted to any server — there is no server for it to go to.

You can verify this yourself: open your browser's Network tab while using the
app. You will see no requests carrying your data.

## What is stored, and only with consent

By default, InsightForge stores nothing between sessions. If you explicitly
check the storage-consent option during column mapping, your **column mapping
preference only** (which CSV header maps to which role — not your data) is
saved to `localStorage` on your device, so you don't have to re-map the same
export format next time. You can revoke this at any time via the **Delete All
Data** action, which also clears all in-memory state immediately.

## What is never stored or transmitted

- Your raw CSV/TSV/JSON file contents
- Individual customer records, names, emails, or addresses
- Review text
- Any derived analysis

## Geographic data

If you provide latitude/longitude, points are rounded to roughly 11km precision
before being plotted, so the map cannot reveal an exact address. Aggregate
country/region tables use whatever precision your source data already has.

## Demonstration data

The synthetic demo dataset bundled with the app and shown in the guided tour
is entirely fictional. It contains no real customer, order, or review data.

## Reports

The Report Builder excludes raw individual customer rows by default. If you
choose to include a customer table, it is limited to the aggregated segment
view (segment, count, revenue share) unless you explicitly add more columns.

## Your responsibility

InsightForge processes whatever you upload. If your CSV contains personal
data, handling that data appropriately (consent, retention, regional privacy
law) remains your responsibility as the data controller — the app is a local
processing tool, not a compliance product.
