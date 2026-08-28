-- ==========================================================================
-- Erwin Forrest Builders CRM — Supabase schema
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
  primary_contact_id uuid,        -- deprecated: superseded by primary_contact_name (free text)
  primary_contact_name text,
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
  best_time_to_contact text,      -- Morning | Evening | Night | Whenever
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
  secondary_contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  stage text not null default 'new_lead',
  status text not null default 'active',       -- active | won | lost
  value numeric not null default 0,            -- "Budget" in the UI
  revenue_percent numeric,                     -- % of budget expected as revenue
  project_type text,
  source text,
  expected_close_date date,                    -- deprecated, no longer set from the UI
  notes text,
  lost_reason text,
  history jsonb not null default '[]',          -- activity timeline, same shape as before
  project_stage text,                          -- design | pre_con | construction | completed (only once won)
  project_status text,                         -- on_track | delayed (only once won)
  permit_status text,                          -- deprecated: superseded by `permits` (a project can have many)
  permit_township text,                        -- one township per project — all its permits are filed there
  permits jsonb not null default '[]',          -- [{ type: 'Electrical', status: 'submitted' }, ...]
  projected_start_date date,                   -- target construction start (only once won)
  target_completion_date date,                 -- target finish, for the Gantt-style Project Calendar
  assigned_to text,                            -- who's currently running this project
  estimator text,
  field_manager text,
  designer text,
  precon_status text,                          -- active | on_hold | lost | complete (Pre-Con "Record status")
  precon_steps jsonb not null default '[]',    -- [{ phase: 'lead_up'|'pre_construction', label, status }, ...]
  precon_notes text,                            -- free-text notes on the Pre-Con checklist
  contacted_steps jsonb not null default '[]', -- [{ key, done, date }, ...] — the "Contacted" follow-up checklist
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Client Questionnaires — public, no-login forms a lead fills out (a
-- short "quick" pre-contract one and a longer "construction" one). The lead
-- never signs in; questionnaire.html at the repo root submits with just
-- the anon key, so questionnaire_responses is the one table anonymous
-- visitors can write to anywhere in this database (insert-only — see
-- RLS below). Everything else, including questionnaire_status, stays
-- locked to the shared team login; see the trigger further down for how
-- "answered" gets recorded from an anonymous submission without
-- granting anon any access to questionnaire_status itself.
-- ---------------------------------------------------------------------

-- One row per lead, tracking whether/when each questionnaire was sent
-- and answered — what the Client Questionnaire page's table reads from.
create table if not exists questionnaire_status (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  quick_sent_at timestamptz,
  quick_answered_at timestamptz,
  detailed_sent_at timestamptz,
  detailed_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

-- The actual submitted answers — one row per submission. If a lead is
-- ever re-sent a link and submits again, the newest row is what counts
-- (both for display and for questionnaire_status.answered_at below).
create table if not exists questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  questionnaire_type text not null check (questionnaire_type in ('quick', 'construction')),
  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Additive migration (safe to re-run) — patches a table created before
-- these columns existed. New installs get them from the CREATE TABLE
-- statements above already; these are here so re-running this whole
-- file always brings an existing project up to date too.
-- ---------------------------------------------------------------------
alter table companies add column if not exists primary_contact_name text;
alter table contacts add column if not exists best_time_to_contact text;
alter table leads add column if not exists secondary_contact_id uuid references contacts(id) on delete set null;
alter table leads add column if not exists revenue_percent numeric;
alter table leads add column if not exists project_stage text;
alter table leads add column if not exists project_status text;
alter table leads add column if not exists permit_status text;
alter table leads add column if not exists permit_township text;
alter table leads add column if not exists permits jsonb not null default '[]';
alter table leads add column if not exists projected_start_date date;
alter table leads add column if not exists target_completion_date date;
alter table leads add column if not exists assigned_to text;
alter table leads add column if not exists estimator text;
alter table leads add column if not exists field_manager text;
alter table leads add column if not exists designer text;
alter table leads add column if not exists precon_status text;
alter table leads add column if not exists precon_steps jsonb not null default '[]';
alter table leads add column if not exists precon_notes text;
alter table leads add column if not exists contacted_steps jsonb not null default '[]';

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

drop trigger if exists questionnaire_status_set_updated_at on questionnaire_status;
create trigger questionnaire_status_set_updated_at before update on questionnaire_status
  for each row execute function set_updated_at();

drop trigger if exists questionnaire_responses_set_updated_at on questionnaire_responses;
create trigger questionnaire_responses_set_updated_at before update on questionnaire_responses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- When a questionnaire submission comes in (from the anonymous public
-- page — see questionnaire.html), automatically upsert the matching
-- questionnaire_status.{type}_answered_at. This function runs as its
-- owner (security definer), so it can write to questionnaire_status even
-- though anon itself has zero access to that table — the only thing an
-- anonymous submission can actually do is insert into
-- questionnaire_responses; this is a server-side side effect of that,
-- not a second client-side write.
-- ---------------------------------------------------------------------
-- NOTE: the app's second questionnaire is called "construction" (was
-- "detailed" until Aug 2026), but the column names below stay
-- `detailed_sent_at`/`detailed_answered_at` on purpose — renaming a
-- column here would need a migration, and nothing requires the column
-- name to match the questionnaire_type value it's tracking.
create or replace function mark_questionnaire_answered()
returns trigger as $$
begin
  insert into questionnaire_status (lead_id, quick_answered_at, detailed_answered_at)
  values (
    new.lead_id,
    case when new.questionnaire_type = 'quick' then new.submitted_at else null end,
    case when new.questionnaire_type = 'construction' then new.submitted_at else null end
  )
  on conflict (lead_id) do update set
    quick_answered_at = case when new.questionnaire_type = 'quick' then new.submitted_at else questionnaire_status.quick_answered_at end,
    detailed_answered_at = case when new.questionnaire_type = 'construction' then new.submitted_at else questionnaire_status.detailed_answered_at end,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists questionnaire_responses_mark_answered on questionnaire_responses;
create trigger questionnaire_responses_mark_answered
  after insert on questionnaire_responses
  for each row execute function mark_questionnaire_answered();

-- ---------------------------------------------------------------------
-- Row Level Security — any signed-in user (the one shared team login)
-- can read/write everything on every table below. The one deliberate
-- exception is questionnaire_responses, which also allows anonymous
-- INSERT (see its own policy below) — that's the only anonymous write
-- access anywhere in this database.
-- ---------------------------------------------------------------------
alter table companies enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;
alter table questionnaire_status enable row level security;
alter table questionnaire_responses enable row level security;

drop policy if exists "authenticated full access" on companies;
create policy "authenticated full access" on companies
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on contacts;
create policy "authenticated full access" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on leads;
create policy "authenticated full access" on leads
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on questionnaire_status;
create policy "authenticated full access" on questionnaire_status
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on questionnaire_responses;
create policy "authenticated full access" on questionnaire_responses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "anon insert only" on questionnaire_responses;
create policy "anon insert only" on questionnaire_responses
  for insert to anon
  with check (questionnaire_type in ('quick', 'construction'));

-- ---------------------------------------------------------------------
-- Realtime — lets every open browser tab see changes made by teammates
-- (or a lead's own questionnaire submission) immediately, without a
-- manual refresh.
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
  begin
    execute 'alter publication supabase_realtime add table questionnaire_status';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table questionnaire_responses';
  exception when duplicate_object then null;
  end;
end $$;
