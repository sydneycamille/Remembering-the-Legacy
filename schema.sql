-- Run in the Supabase SQL editor. Enables fuzzy name search and Row-Level Security.
create extension if not exists pg_trgm;

create table locations (
  id bigint generated always as identity primary key,
  county text, state text not null
);

create table records (
  id bigint generated always as identity primary key,
  full_name text not null,
  date date,
  location_id bigint references locations(id),
  narrative text,
  tags text[] default '{}',
  status text not null default 'pending' check (status in ('pending','published','removed')),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table sources (
  id bigint generated always as identity primary key,
  record_id bigint not null references records(id) on delete cascade,
  citation text not null  -- every published record needs at least one
);

create table submissions (
  id bigint generated always as identity primary key,
  type text not null check (type in ('new_record','correction','removal')),
  details text not null,
  contact text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create index records_name_trgm on records using gin (full_name gin_trgm_ops);
create index records_fts on records using gin (to_tsvector('english', full_name));

-- Public view: published records only, with joined location and sources.
-- Runs with owner rights so anon never needs direct table access.
create view v_records as
select r.id, r.full_name, r.date::text as date, l.county, l.state, r.tags, r.narrative,
  coalesce((select array_agg(s.citation) from sources s where s.record_id = r.id), '{}') as sources
from records r left join locations l on l.id = r.location_id
where r.status = 'published';

alter table records enable row level security;
alter table locations enable row level security;
alter table sources enable row level security;
alter table submissions enable row level security;

-- Admin role: set app_metadata {"role":"admin"} on moderator accounts.
create policy "admin all records" on records for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "admin all sources" on sources for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "admin all locations" on locations for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "admin all submissions" on submissions for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Public: insert pending submissions only; read published records via the view.
create policy "public can submit" on submissions for insert to anon
  with check (status = 'pending');
grant select on v_records to anon;
grant insert on submissions to anon;
