-- PulseBI portfolio query library for prepared queries.
-- Replace $1 with a parameter supplied by an authenticated server/database client.
-- Always rely on caller RLS as well as this owner filter.

-- 01 / Monthly quote pipeline, accepted value, and month-on-month changes.
with months as (
 select date_trunc('month',q.issued_at)::date as month,
 count(*) filter (where q.status in ('sent','accepted','declined')) as decided_or_sent,
 count(*) filter (where q.status='accepted') as accepted,
 coalesce(sum(q.amount_cents) filter (where q.status='accepted'),0)/100.0 as accepted_value_zar,
 coalesce(sum(q.estimated_cost_cents) filter (where q.status='accepted'),0)/100.0 as estimated_cost_zar
 from public.servicepulse_quotes q
 where q.owner_id=$1
 group by 1
)
select month,decided_or_sent,accepted,
 round(100.0*accepted/nullif(decided_or_sent,0),1) as accepted_pct_of_sent,
 accepted_value_zar,accepted_value_zar-estimated_cost_zar as estimated_gross_profit_zar,
 round(100.0*(accepted_value_zar-lag(accepted_value_zar) over (order by month))/
 nullif(lag(accepted_value_zar) over(order by month),0),2) as mom_growth_pct
from months order by month;

-- 02 / Conversion funnel by original lead source.
select lower(trim(l.source)) as lead_source,
 count(distinct l.id) as enquiries,
 count(distinct l.id) filter (where l.status in ('quoted','won','lost')) as progressed_leads,
 count(distinct l.id) filter (where l.status='won') as won_leads,
 round(100.0*count(distinct l.id) filter(where l.status='won')/
 nullif(count(distinct l.id) filter(where l.status in ('won','lost')),0),1) as win_rate_pct
from public.servicepulse_leads l
where l.owner_id=$1
group by 1 order by won_leads desc;

-- 03 / Identify high-value customers and rank by accepted quote value.
with customers as (
 select l.client_name,
 count(q.id) filter(where q.status='accepted') as won_quotes,
 coalesce(sum(q.amount_cents) filter(where q.status='accepted'),0)/100.0 as value_zar
 from public.servicepulse_leads l
 left join public.servicepulse_quotes q
 on q.lead_id=l.id and q.owner_id=l.owner_id
 where l.owner_id=$1
 group by l.client_name
)
select client_name,won_quotes,value_zar,
 dense_rank() over(order by value_zar desc) as client_rank
from customers order by client_rank,client_name;

-- 04 / Data quality: orphaned statuses and missing attribution.
select
 count(*) filter(where trim(source)='' or source='unknown') as unattributed_leads,
 count(*) filter(where status='won' and not exists (
    select 1 from public.servicepulse_quotes q
    where q.lead_id=l.id and q.owner_id=l.owner_id and q.status='accepted'
 )) as won_status_without_accepted_quote
from public.servicepulse_leads l where l.owner_id=$1;

-- 05 / Safe view in 001: SELECT * FROM public.servicepulse_quote_summary
-- with an authenticated client. Security invoker prevents default view RLS bypass.
