-- Comparador Auto Pro — esquema V1 para Supabase/Postgres
-- Ainda não aplicado a produção. Mantido versionado para revisão.

create extension if not exists pgcrypto;

create table if not exists cap_analyses (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_domain text,
  status text not null default 'queued'
    check (status in ('queued','reading','searching','valuing','done','failed')),
  current_purchase_price numeric(12,2),
  market_value numeric(12,2),
  sale_likely numeric(12,2),
  sale_fast numeric(12,2),
  max_purchase numeric(12,2),
  absolute_max numeric(12,2),
  expected_margin numeric(12,2),
  confidence_pct integer check (confidence_pct between 0 and 100),
  decision text,
  warnings jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists cap_vehicles (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references cap_analyses(id) on delete cascade,
  role text not null check (role in ('subject','comparable')),
  source_url text,
  source_domain text,
  external_id text,
  make text,
  model text,
  generation text,
  trim text,
  body_type text,
  fuel text,
  battery_kwh numeric(7,2),
  engine_cc integer,
  power_cv integer,
  drivetrain text,
  transmission text,
  first_registration date,
  year integer,
  mileage_km integer,
  origin text,
  vat_deductible boolean,
  warranty_months integer,
  seller_type text,
  price numeric(12,2),
  equipment jsonb not null default '[]'::jsonb,
  condition_notes jsonb not null default '[]'::jsonb,
  raw_extraction jsonb not null default '{}'::jsonb,
  seen_at timestamptz not null default now(),
  unique(source_url)
);

create index if not exists cap_vehicles_signature_idx
  on cap_vehicles (make, model, year, fuel, mileage_km);

create table if not exists cap_comparable_results (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references cap_analyses(id) on delete cascade,
  vehicle_id uuid not null references cap_vehicles(id) on delete cascade,
  similarity numeric(5,2),
  adjusted_price numeric(12,2),
  used_in_valuation boolean not null default false,
  exclusion_reason text,
  weight numeric(10,6),
  created_at timestamptz not null default now(),
  unique(analysis_id, vehicle_id)
);

create table if not exists cap_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_default boolean not null default false,
  auction_fee_rule jsonb not null default '{}'::jsonb,
  transport_default numeric(12,2) not null default 0,
  registration_default numeric(12,2) not null default 0,
  reconditioning_default numeric(12,2) not null default 0,
  warranty_reserve_default numeric(12,2) not null default 0,
  stock_finance_default numeric(12,2) not null default 0,
  other_default numeric(12,2) not null default 0,
  target_margin numeric(12,2) not null default 3000,
  minimum_margin numeric(12,2) not null default 1800,
  updated_at timestamptz not null default now()
);

create table if not exists cap_memory_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null
    check (rule_type in ('liquidity','technical_risk','commercial_preference','margin_cost')),
  make text,
  model text,
  generation text,
  trim text,
  year_min integer,
  year_max integer,
  mileage_min integer,
  mileage_max integer,
  condition_json jsonb not null default '{}'::jsonb,
  statement text not null,
  effect_json jsonb not null default '{}'::jsonb,
  source text not null default 'user',
  evidence_level text not null default 'observation'
    check (evidence_level in ('observation','internal_history','market_data','confirmed')),
  confidence numeric(5,4) not null default 0.60 check (confidence between 0 and 1),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cap_memory_scope_idx
  on cap_memory_rules (make, model, trim, active);

create table if not exists cap_sales_outcomes (
  id uuid primary key default gen_random_uuid(),
  vehicle_signature jsonb not null,
  purchase_price numeric(12,2) not null,
  purchase_costs numeric(12,2) not null default 0,
  advertised_price numeric(12,2),
  final_sale_price numeric(12,2),
  stock_days integer,
  margin_real numeric(12,2),
  sale_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists cap_chat_messages (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references cap_analyses(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  extracted_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cap_source_health (
  domain text primary key,
  adapter_type text not null,
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0,
  notes text
);
