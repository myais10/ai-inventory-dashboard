-- =====================================================================
-- AI Inventory & Demand Intelligence — initial multi-tenant schema
-- Every business table carries company_id and is protected by RLS.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.member_role as enum ('owner', 'admin', 'manager', 'viewer');
create type public.membership_status as enum ('active', 'invited', 'disabled');
create type public.trial_status as enum ('active', 'expired', 'converted');
create type public.po_status as enum ('draft', 'open', 'partial', 'received', 'cancelled');
create type public.recommendation_type as enum ('reorder', 'stockout_risk', 'excess_stock', 'slow_stock', 'lost_demand', 'supplier_issue');
create type public.recommendation_priority as enum ('high', 'medium', 'low');
create type public.recommendation_status as enum ('new', 'in_review', 'approved', 'dismissed', 'completed');
create type public.enquiry_outcome as enum ('won', 'lost_no_stock', 'lost_price', 'open');
create type public.import_status as enum ('pending', 'validating', 'processing', 'completed', 'failed');

-- ---------- Helpers ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Tenancy ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  industry text,
  currency char(3) not null default 'USD',
  timezone text not null default 'America/Chicago',
  trial_start timestamptz not null default now(),
  trial_end timestamptz not null default (now() + interval '7 days'),
  trial_status public.trial_status not null default 'active',
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'growth', 'enterprise')),
  onboarding_completed boolean not null default false,
  data_source text not null default 'sample' check (data_source in ('sample', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_end > trial_start)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  job_title text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  invited_email text,
  role public.member_role not null default 'viewer',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (company_id, user_id),
  check (user_id is not null or invited_email is not null)
);
create index memberships_user_idx on public.memberships (user_id);

-- Membership checks are SECURITY DEFINER to avoid recursive RLS evaluation on memberships.
create or replace function public.is_company_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.has_company_role(cid uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active' and m.role = any (roles)
  );
$$;

-- ---------- Master data ----------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  city text,
  state text,
  country char(2) default 'US',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories (id) on delete set null,
  unique (company_id, name),
  unique (company_id, id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  country char(2),
  quoted_lead_time_days integer not null default 14 check (quoted_lead_time_days between 0 and 365),
  payment_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  sku text not null,
  name text not null,
  category_id uuid,
  brand text,
  uom text not null default 'ea',
  unit_cost numeric(14, 4) not null default 0 check (unit_cost >= 0),
  unit_price numeric(14, 4) not null default 0 check (unit_price >= 0),
  moq integer not null default 1 check (moq >= 1),
  order_multiple integer not null default 1 check (order_multiple >= 1),
  lead_time_days integer check (lead_time_days between 0 and 365),
  safety_stock_override numeric(14, 2) check (safety_stock_override >= 0),
  primary_supplier_id uuid,
  default_warehouse_id uuid,
  status text not null default 'active' check (status in ('active', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku),
  unique (company_id, id),
  -- composite FKs guarantee related rows belong to the SAME tenant
  foreign key (company_id, category_id) references public.categories (company_id, id),
  foreign key (company_id, primary_supplier_id) references public.suppliers (company_id, id),
  foreign key (company_id, default_warehouse_id) references public.warehouses (company_id, id)
);
create index products_company_category_idx on public.products (company_id, category_id);
create index products_company_supplier_idx on public.products (company_id, primary_supplier_id);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_id uuid not null,
  product_id uuid not null,
  supplier_sku text,
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  lead_time_days integer check (lead_time_days between 0 and 365),
  is_primary boolean not null default false,
  effective_date date not null default current_date,
  unique (supplier_id, product_id, effective_date),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade
);
create index supplier_products_product_idx on public.supplier_products (company_id, product_id, effective_date desc);

-- ---------- Inventory ----------
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  on_hand numeric(14, 2) not null default 0,
  allocated numeric(14, 2) not null default 0 check (allocated >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade,
  foreign key (company_id, warehouse_id) references public.warehouses (company_id, id) on delete cascade
);
create index inventory_company_idx on public.inventory (company_id);

create table public.inventory_snapshots (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  snapshot_date date not null,
  on_hand numeric(14, 2) not null,
  inventory_value numeric(16, 2) not null,
  unique (product_id, warehouse_id, snapshot_date),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade,
  foreign key (company_id, warehouse_id) references public.warehouses (company_id, id) on delete cascade
);
create index inventory_snapshots_company_date_idx on public.inventory_snapshots (company_id, snapshot_date);

-- ---------- Sales ----------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  order_number text not null,
  customer_name text,
  order_date date not null,
  warehouse_id uuid,
  total numeric(16, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, order_number),
  unique (company_id, id),
  foreign key (company_id, warehouse_id) references public.warehouses (company_id, id)
);
create index sales_company_date_idx on public.sales (company_id, order_date);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  qty numeric(14, 2) not null check (qty >= 0),
  unit_price numeric(14, 4) not null default 0,
  line_total numeric(16, 2) generated always as (qty * unit_price) stored,
  foreign key (company_id, sale_id) references public.sales (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade
);
create index sale_lines_company_product_idx on public.sale_lines (company_id, product_id);

-- ---------- Purchasing ----------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  po_number text not null,
  supplier_id uuid not null,
  warehouse_id uuid,
  status public.po_status not null default 'open',
  order_date date not null,
  expected_date date,
  received_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, po_number),
  unique (company_id, id),
  check (expected_date is null or expected_date >= order_date),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id),
  foreign key (company_id, warehouse_id) references public.warehouses (company_id, id)
);
create index purchase_orders_company_status_idx on public.purchase_orders (company_id, status, expected_date);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  purchase_order_id uuid not null,
  product_id uuid not null,
  qty numeric(14, 2) not null check (qty > 0),
  qty_received numeric(14, 2) not null default 0 check (qty_received >= 0),
  unit_cost numeric(14, 4) not null default 0,
  foreign key (company_id, purchase_order_id) references public.purchase_orders (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade
);
create index po_lines_company_product_idx on public.purchase_order_lines (company_id, product_id);

-- ---------- Demand ----------
create table public.sales_enquiries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  enquiry_date date not null,
  customer_name text,
  requested_item text not null,
  item_key text not null,
  product_id uuid,
  category text,
  qty numeric(14, 2) not null default 1 check (qty > 0),
  quoted_price numeric(14, 4),
  quoted boolean not null default false,
  outcome public.enquiry_outcome not null default 'open',
  created_at timestamptz not null default now(),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete set null (product_id)
);
create index sales_enquiries_company_key_idx on public.sales_enquiries (company_id, item_key, enquiry_date);

create table public.demand_forecasts (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null,
  period_start date not null,
  forecast_qty numeric(14, 2) not null,
  lower_qty numeric(14, 2),
  upper_qty numeric(14, 2),
  method text not null,
  generated_at timestamptz not null default now(),
  unique (product_id, period_start),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade
);

-- ---------- Intelligence ----------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  external_key text not null, -- deterministic engine id, e.g. rec-reorder-skf-6205-2rs
  type public.recommendation_type not null,
  priority public.recommendation_priority not null,
  status public.recommendation_status not null default 'new',
  product_id uuid,
  supplier_id uuid,
  title text not null,
  issue text not null,
  recommendation text not null,
  impact_value numeric(16, 2) not null default 0,
  suggested_qty numeric(14, 2),
  payload jsonb not null default '{}'::jsonb, -- facts + reasoning snapshot
  ai_explanation text, -- optional narrative from the AI explanation layer (never numbers of record)
  acted_by uuid references auth.users (id),
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, external_key),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete cascade,
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete cascade
);
create index recommendations_company_status_idx on public.recommendations (company_id, status, priority);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index alerts_company_user_idx on public.alerts (company_id, user_id, read_at);

-- ---------- Data onboarding ----------
create table public.data_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references auth.users (id),
  file_name text not null,
  kind text not null check (kind in ('inventory', 'sales', 'purchase_orders', 'enquiries', 'mixed')),
  status public.import_status not null default 'pending',
  column_mapping jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (company_id, id)
);

create table public.data_import_rows (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  import_id uuid not null,
  row_number integer not null,
  raw jsonb not null,
  status text not null check (status in ('valid', 'error', 'duplicate', 'skipped')),
  errors jsonb not null default '[]'::jsonb,
  foreign key (company_id, import_id) references public.data_imports (company_id, id) on delete cascade
);
create index data_import_rows_import_idx on public.data_import_rows (import_id, status);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null, -- e.g. netsuite, epicor_prophet21, sap_b1, quickbooks
  status text not null default 'disconnected' check (status in ('disconnected', 'connecting', 'connected', 'error')),
  config jsonb not null default '{}'::jsonb, -- non-secret settings only; credentials live in Supabase Vault
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, provider)
);

-- ---------- Billing (Stripe-ready) ----------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  plan text not null default 'trial',
  seats integer not null default 5,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Audit ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['companies', 'profiles', 'suppliers', 'products', 'purchase_orders', 'recommendations', 'subscriptions'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy "members read their companies" on public.companies
  for select using (public.is_company_member(id));
create policy "owners/admins update company" on public.companies
  for update using (public.has_company_role(id, array['owner', 'admin']::public.member_role[]));
-- Companies are only created through create_company_for_current_user().

create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "read teammates' profiles" on public.profiles for select using (
  exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = profiles.id
  )
);
create policy "update own profile" on public.profiles for update using (id = auth.uid());

create policy "members read memberships" on public.memberships
  for select using (public.is_company_member(company_id));
create policy "owners/admins manage memberships" on public.memberships
  for all using (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]));

-- Standard tenant tables: members read; owners/admins/managers write.
do $$
declare t text;
begin
  foreach t in array array[
    'warehouses', 'categories', 'suppliers', 'products', 'supplier_products', 'inventory', 'inventory_snapshots',
    'sales', 'sale_lines', 'purchase_orders', 'purchase_order_lines', 'sales_enquiries', 'demand_forecasts',
    'recommendations', 'data_imports', 'data_import_rows'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "tenant read" on public.%I for select using (public.is_company_member(company_id))', t);
    execute format($p$create policy "tenant write" on public.%I for all
      using (public.has_company_role(company_id, array['owner','admin','manager']::public.member_role[]))
      with check (public.has_company_role(company_id, array['owner','admin','manager']::public.member_role[]))$p$, t);
  end loop;
end $$;

-- Settings-level tables: only owners/admins write.
alter table public.integrations enable row level security;
create policy "tenant read" on public.integrations for select using (public.is_company_member(company_id));
create policy "admin write" on public.integrations for all
  using (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]));

-- Alerts: user sees company-wide alerts and their own.
alter table public.alerts enable row level security;
create policy "read alerts" on public.alerts for select
  using (public.is_company_member(company_id) and (user_id is null or user_id = auth.uid()));
create policy "mark own alerts read" on public.alerts for update
  using (public.is_company_member(company_id) and (user_id is null or user_id = auth.uid()));

-- Subscriptions are written only by the service role (Stripe webhooks).
alter table public.subscriptions enable row level security;
create policy "members read subscription" on public.subscriptions for select using (public.is_company_member(company_id));

-- Audit logs: append by members, read by owners/admins.
alter table public.audit_logs enable row level security;
create policy "members append audit" on public.audit_logs for insert
  with check (public.is_company_member(company_id) and actor_id = auth.uid());
create policy "admins read audit" on public.audit_logs for select
  using (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]));

-- =====================================================================
-- Functions
-- =====================================================================

-- Create profile on signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a company + owner membership + 7-day trial for the signed-in user.
create or replace function public.create_company_for_current_user(company_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  base_slug text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if char_length(trim(company_name)) < 2 then raise exception 'invalid company name'; end if;

  base_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'));
  base_slug := left(coalesce(nullif(base_slug, ''), 'company'), 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.companies (name, slug, trial_start, trial_end)
  values (trim(company_name), base_slug, now(), now() + interval '7 days')
  returning id into cid;

  insert into public.memberships (company_id, user_id, role, status) values (cid, uid, 'owner', 'active');
  insert into public.subscriptions (company_id, status, plan, trial_end) values (cid, 'trialing', 'trial', now() + interval '7 days');
  insert into public.warehouses (company_id, code, name) values (cid, 'MAIN', 'Main Warehouse');
  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id)
  values (cid, uid, 'company.created', 'company', cid::text);
  return cid;
end $$;

revoke all on function public.create_company_for_current_user(text) from public;
grant execute on function public.create_company_for_current_user(text) to authenticated;

-- Nightly job (pg_cron) can flip expired trials.
create or replace function public.expire_trials() returns void
language sql security definer set search_path = public as $$
  update public.companies set trial_status = 'expired'
  where trial_status = 'active' and trial_end < now() and plan = 'trial';
$$;
