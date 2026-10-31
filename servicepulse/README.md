# ServicePulse SA + PulseBI — pilot launch (no Render)

ServicePulse SA is a **new service-business project** selling websites, instant quote flows, and lead/analytics tools. PulseBI is the supporting data analysis portfolio. This code lives inside the existing **public** InsightForge repository solely to reuse its working GitHub Pages workflow. The two apps remain separate routes.

## Public pages

- `/servicepulse/`: public storefront, working example cleaning-quote calculator and WhatsApp enquiry composition
- `/servicepulse/analytics.html`: offline sample-data analytics, local CSV import/export
- Full pre-existing InsightForge dashboard at `/`

After the existing `.github/workflows/deploy.yml` finishes successfully, the expected public URL is:

`https://iederees-create.github.io/insightforge-business-analytics-dashboard/servicepulse/`

The GitHub Actions workflow builds Vite; Vite copies `public/servicepulse/` to `dist/servicepulse/` verbatim. The new storefront requires no Node server, Render, API key or extra hosting.

## What is actually operational today

- Responsive storefront, published service offerings/prices *as indicative pilot offers*
- Instant quote logic with area, rooms, bathrooms, extras and frequency discounts
- WhatsApp enquiry buttons and user-reviewed, prefilled messages
- Dashboard that calculates KPIs from clearly labelled synthetic data **or a local CSV**; CSV never leaves the browser
- GitHub versioning and Pages deployment pipeline

## What is deliberately not represented as operational

- The sample data are fictional, **not proof of sales or paying customers**
- Contact enquiries are only sent when the visitor chooses Send in WhatsApp
- No payment checkout, signed-in customer accounts, persistent private CRM, live merchant webhooks or BI publishing credentials are enabled
- No registered-company claim, verified testimonials, or unverified revenue claim
- No Supabase changes have been deployed; only the migration file is prepared

## Supabase integration

The previously selected white-label website Supabase project was `sijvvbozaufzpjirijhb`, which **is not available through the current Supabase connection**. Do **not** run the migration against a RAVERSUS database or Inventory_Management database simply because it is visible.

After the project is reconnected and inspected:
1. Review `sql/001_servicepulse_schema.sql` for compatibility, then apply once to the approved project.
2. Test sign-up, owner isolation and row-level security with two test identities.
3. Implement/enable a signed-in CRM frontend and verify public lead intake through a rate-limited Edge Function if needed.
4. Keep merchant secrets exclusively in Edge Functions; validate payment webhooks before marking any order as settled.
5. Use scoped DB roles and anonymised or synthetic portfolio demo datasets.

## BI portfolio technical assets

- `sql/001_servicepulse_schema.sql`: private owner-scoped relational data model and security-invoker analytics view
- `sql/002_bi_queries.sql`: advanced SQL reporting queries (CTEs, window functions, source funnel, ranked customers, QA checks)
- `python/etl.py`: Python stdlib CSV ingestion, validation, monthly/source metrics and JSON reporting
- `python/test_etl.py`: unit tests for validation and calculations
- `sample/sample_leads.csv`: explicitly fictional test records

Run:

```bash
python -m unittest discover -s servicepulse/python -p "test_*.py"
python servicepulse/python/etl.py --input servicepulse/sample/sample_leads.csv --out servicepulse/reports
```

The SQL and Python code are technical portfolio evidence; the browser charts on this MVP **do not** claim to be Power BI/Tableau reports. The existing InsightForge application provides additional browser-only visual analytics; Power BI/Tableau deliverables are separate milestones.

## Contact and privacy

The default WhatsApp recipient (`27845272182`) was observed on the owner's pre-existing public freelancer website; **confirm that it is still correct before advertising ServicePulse**. The site does not keep form entries, set tracking cookies, take payment details, or upload CSV files. If real sales start, document the business's legal entity, privacy policy and fulfilment/payment terms before taking payments.

## Business milestones

1. Verify business branding, contact number and merchant setup.
2. Sign first pilot business with a scoped project statement and invoices.
3. Enable the approved Supabase CRM and record actual enquiries with consent.
4. Build the separate private PulseBI tenant dashboards and real Power BI/Tableau workbooks.
5. Publish a case study with real metrics only when accurately attributable and permissioned.
