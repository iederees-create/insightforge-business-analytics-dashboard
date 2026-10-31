# ServicePulse public transparency v2

- Public UI: `public/servicepulse/analytics.html#live-transparency`
- Source of truth: `sijvvbozaufzpjirijhb` (approved portfolio Supabase instance).
- Public API: four dedicated `servicepulse_public_*` tables with SELECT-only privileges granted to `anon`, RLS enabled.
- Private data: `servicepulse_private_enquiries`, `servicepulse_private_quotes`, `servicepulse_private_payments`; **no public or authenticated Data API rights**. Public-facing stats are aggregates updated by database triggers.
- The prior authentication portal now redirects to public metrics.
- Sample analytics further down the page remain labelled as fictional. Public totals come from the real, empty-at-launch dataset.
- No payments are marked as settled without independent gateway verification.
- The public submission Edge Function is not yet enabled, so the main website's existing WhatsApp workflow remains the enquiry channel. Do not publish a direct SQL insert to private tables from the browser.
- Rate-limiting table and invocation RPC reserved for eventual submission function. No login required for readers.
