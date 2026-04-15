-- RYDZ Distributed MapKit Dispatch
--
-- Replaces rider-side Google DistanceMatrix fan-out with a Supabase
-- handshake: the rider writes a dispatch_requests row, every online driver
-- iPhone computes its own chain-walked ETA via Apple MapKit (free,
-- unlimited, traffic-aware) and writes a dispatch_responses row. The rider
-- then picks the minimum and assigns the ride.
--
-- This keeps the rider app platform-agnostic (the rider just reads a
-- database row, no native plugins needed — works unchanged on Android)
-- while the expensive routing math runs for free on the driver fleet.
--
-- Run this once in the Supabase SQL editor. Tables are idempotent via
-- "if not exists" so re-running is safe.

create table if not exists dispatch_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid,
  pu_lat double precision not null,
  pu_lng double precision not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 seconds')
);

create index if not exists dispatch_requests_created_at_idx
  on dispatch_requests (created_at desc);

create table if not exists dispatch_responses (
  request_id uuid not null references dispatch_requests(id) on delete cascade,
  driver_id uuid not null,
  eta_secs integer not null,
  distance_m integer,
  created_at timestamptz not null default now(),
  primary key (request_id, driver_id)
);

create index if not exists dispatch_responses_request_id_idx
  on dispatch_responses (request_id);

-- RLS: match the project-wide "allow all" convention used on rides/users.
alter table dispatch_requests  enable row level security;
alter table dispatch_responses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dispatch_requests'
      and policyname = 'allow all'
  ) then
    create policy "allow all" on dispatch_requests
      for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dispatch_responses'
      and policyname = 'allow all'
  ) then
    create policy "allow all" on dispatch_responses
      for all using (true) with check (true);
  end if;
end $$;

-- Enable Realtime so drivers receive INSERT events on dispatch_requests
-- and riders receive INSERT events on dispatch_responses. "add table" is
-- not idempotent, so wrap in a guarded block.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'dispatch_requests'
  ) then
    alter publication supabase_realtime add table dispatch_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'dispatch_responses'
  ) then
    alter publication supabase_realtime add table dispatch_responses;
  end if;
end $$;

-- Optional housekeeping: a periodic cleanup job could delete rows older
-- than a few minutes. For now we rely on expires_at + manual cleanup; the
-- dispatch flow only reads rows from its own request_id so stale rows do
-- not affect correctness.
