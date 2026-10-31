-- ServicePulse SA / PulseBI: initial private CRM schema
-- Do NOT apply to a RAVERSUS or unrelated project. Target the approved white-label Supabase project.
-- Every table is private to its authenticated owner; no anonymous reads/writes.
create extension if not exists pgcrypto;

create table if not exists public.servicepulse_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (length(trim(business_name)) between 2 and 120),
  currency text not null default 'ZAR' check (currency='ZAR'),
  created_at timestamptz not null default now(),
  unique (id,owner_id)
);
create index if not exists sp_workspaces_owner on public.servicepulse_workspaces(owner_id);

create table if not exists public.servicepulse_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  client_name text not null check (length(trim(client_name)) between 1 and 120),
  client_email text not null default '' check (length(client_email)<=254),
  client_phone text not null default '' check (length(client_phone)<=40),
  service text not null check (length(trim(service)) between 1 and 120),
  source text not null default 'unknown' check (length(trim(source)) between 1 and 60),
  status text not null default 'new' check (status in ('new','contacted','quoted','won','lost')),
  inquiry_date date not null default current_date,
  notes text not null default '' check (length(notes)<=2000),
  created_at timestamptz not null default now(),
  unique (id,owner_id),
  foreign key (workspace_id,owner_id) references public.servicepulse_workspaces(id,owner_id) on delete cascade
);
create index if not exists sp_leads_owner_date on public.servicepulse_leads(owner_id,inquiry_date desc);
create index if not exists sp_leads_workspace_status on public.servicepulse_leads(workspace_id,status);

create table if not exists public.servicepulse_quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null,
  quote_number text not null check (length(trim(quote_number)) between 1 and 50),
  issued_at date not null default current_date,
  amount_cents bigint not null check (amount_cents>=0),
  estimated_cost_cents bigint not null default 0 check (estimated_cost_cents>=0),
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(owner_id,quote_number),
  foreign key (lead_id,owner_id) references public.servicepulse_leads(id,owner_id) on delete cascade
);
create index if not exists sp_quotes_owner_date on public.servicepulse_quotes(owner_id,issued_at desc);

create table if not exists public.servicepulse_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  incurred_on date not null default current_date,
  category text not null check (length(trim(category)) between 1 and 80),
  amount_cents bigint not null check (amount_cents>=0),
  description text not null default '' check (length(description)<=500),
  created_at timestamptz not null default now(),
  foreign key (workspace_id,owner_id) references public.servicepulse_workspaces(id,owner_id) on delete cascade
);
create index if not exists sp_expenses_owner_date on public.servicepulse_expenses(owner_id,incurred_on desc);

-- There is deliberately no payments table with a client-writable "paid" flag.
-- When merchant credentials are configured, verified gateway webhooks will write to
-- an owner-read-only settlement ledger via a server-side function.

alter table public.servicepulse_workspaces enable row level security;
alter table public.servicepulse_leads enable row level security;
alter table public.servicepulse_quotes enable row level security;
alter table public.servicepulse_expenses enable row level security;

revoke all on public.servicepulse_workspaces,public.servicepulse_leads,
 public.servicepulse_quotes,public.servicepulse_expenses from public,anon,authenticated;
grant select,insert,update,delete on public.servicepulse_workspaces,
 public.servicepulse_leads,public.servicepulse_quotes,public.servicepulse_expenses to authenticated;

create policy sp_workspace_read on public.servicepulse_workspaces for select to authenticated
 using (owner_id=(select auth.uid()));
create policy sp_workspace_insert on public.servicepulse_workspaces for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy sp_workspace_update on public.servicepulse_workspaces for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy sp_workspace_delete on public.servicepulse_workspaces for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy sp_lead_read on public.servicepulse_leads for select to authenticated
 using (owner_id=(select auth.uid()));
create policy sp_lead_insert on public.servicepulse_leads for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy sp_lead_update on public.servicepulse_leads for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy sp_lead_delete on public.servicepulse_leads for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy sp_quote_read on public.servicepulse_quotes for select to authenticated
 using (owner_id=(select auth.uid()));
create policy sp_quote_insert on public.servicepulse_quotes for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy sp_quote_update on public.servicepulse_quotes for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy sp_quote_delete on public.servicepulse_quotes for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy sp_expense_read on public.servicepulse_expenses for select to authenticated
 using (owner_id=(select auth.uid()));
create policy sp_expense_insert on public.servicepulse_expenses for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy sp_expense_update on public.servicepulse_expenses for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy sp_expense_delete on public.servicepulse_expenses for delete to authenticated
 using (owner_id=(select auth.uid()));

comment on table public.servicepulse_quotes is 'Accepted quotes are NOT verified paid revenue; settlement needs provider confirmation.';
-- Analytics view executes as the authenticated caller and respects table RLS.
create or replace view public.servicepulse_quote_summary
 with (security_invoker=true) as
 select l.owner_id, l.workspace_id, date_trunc('month', q.issued_at)::date as month,
 count(*)::integer as quote_count,
 count(*) filter(where q.status='accepted')::integer as accepted_count,
 sum(q.amount_cents) filter(where q.status='accepted')::bigint as accepted_value_cents,
 sum(q.estimated_cost_cents) filter(where q.status='accepted')::bigint as estimated_cost_cents
 from public.servicepulse_quotes q
 join public.servicepulse_leads l on l.id=q.lead_id and l.owner_id=q.owner_id
 group by l.owner_id,l.workspace_id,date_trunc('month', q.issued_at)::date;
revoke all on public.servicepulse_quote_summary from public,anon,authenticated;
grant select on public.servicepulse_quote_summary to authenticated;
