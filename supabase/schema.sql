-- ==========================================================================
-- Erwin Forest Builders CRM — Supabase schema
--
-- How to use: open your Supabase project -> SQL Editor -> New query ->
-- paste this whole file -> Run. Safe to run once on a fresh project.
--
-- Model: a single shared team login (one Supabase Auth user that everyone
-- signs in as). Every table's Row Level Security policy simply requires
-- "you are signed in" — there's no per-user data separation, by design.
-- ==========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  phone text,
  website text,
  address text,
  primary_contact_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  title text,
  company_id uuid references companies(id) on delete set null,
  address text,
  lead_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Companies -> primary contact (added after contacts exists, avoids a
-- circular create-table dependency).
alter table companies
  drop constraint if exists companies_primary_contact_fk;
alter table companies
  add constraint companies_primary_contact_fk
  foreign key (primary_contact_id) references contacts(id) on delete set null;

-- ---------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  stage text not null default 'new_lead',
  status text not null default 'active',       -- active | won | lost
  value numeric not null default 0,
  project_type text,
  source text,
  expected_close_date date,
  notes text,
  lost_reason text,
  history jsonb not null default '[]',          -- activity timeline, same shape as before
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Keep updated_at fresh automatically
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at before update on companies
  for each row execute function set_updated_at();

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at before update on leads
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — any signed-in user (the one shared team login)
-- can read/write everything. No anonymous access at all.
-- ---------------------------------------------------------------------
alter table companies enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;

drop policy if exists "authenticated full access" on companies;
create policy "authenticated full access" on companies
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on contacts;
create policy "authenticated full access" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on leads;
create policy "authenticated full access" on leads
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Realtime — lets every open browser tab see changes made by teammates
-- immediately, without a manual refresh.
-- ---------------------------------------------------------------------
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table companies';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table contacts';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table leads';
  exception when duplicate_object then null;
  end;
end $$;
