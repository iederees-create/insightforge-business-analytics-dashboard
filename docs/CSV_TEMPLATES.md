# CSV Template Guide

InsightForge ships with six starting templates (`src/lib/csv/templates.ts`) that
pre-fill the column mapping for common export formats. Pick the closest match in
the Import Wizard, then adjust any columns that don't match.

## Generic sales CSV
`Date, Order ID, Product, Category, Quantity, Revenue, Channel`
A simple one-row-per-order (or per-line-item) export.

## Etsy-style shop export
`Sale Date, Order ID, Item Name, SKU, Quantity, Order Total, Discount Amount, Ship Country, Full Name`
Matches common Etsy order-CSV column names. **No live Etsy connection is used
or required** — this is purely a column-name template for a file you export
yourself from Etsy's Shop Manager.

## E-commerce orders
`Created At, Order Number, Customer ID, Line Item Name, Line Item Quantity, Total, Cost Per Item, Discount Amount, Sales Channel, Shipping Region, Shipping Country, Financial Status`
Matches typical Shopify/WooCommerce-style exports.

## Customer records
`Customer ID, Customer Name, Country, Region, Acquisition Source`
A customer roster without transaction line items — useful alongside an orders
file, or on its own for acquisition-source breakdowns.

## Review data
`Review Date, Product, Reviewer ID, Rating, Review Text`
For the Sentiment and Topic Explorer.

## Marketing campaign data
`Date, Order ID, Revenue, Channel, Source, Campaign, Discount`
For channel/source and campaign-level revenue breakdowns.

## Your file doesn't match any template

That's fine — pick the closest one as a starting point, or start from no
template and map each column manually in the Mapping step. Only `date` and
`revenue` are required for the core dashboard (see `docs/DATA_SCHEMA.md`).
