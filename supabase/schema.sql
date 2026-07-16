-- =============================================================================
-- The Belfry — knights' shared board schema
--
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). Safe to re-run: every statement is idempotent.
--
-- Security model, in one paragraph:
--   The anon key ships inside the JavaScript bundle and is public by design.
--   It is NOT a secret and NOT the security boundary. The boundary is (1) the
--   four passwords, (2) signups being disabled, and (3) the RLS policies below,
--   which grant nothing to anon and nothing to an authenticated user who is not
--   in the `knights` map. Guests never authenticate and their board never
--   leaves their own browser.
-- =============================================================================


-- 1. Identity map -------------------------------------------------------------
-- Maps a Supabase auth user to a knight. A row here is what makes an account a
-- knight; an account without one can read and write nothing (see policies).
-- This is the second line of defence behind "signups disabled": even if an
-- account is somehow created, it is inert until you add it here by hand.

create table if not exists public.knights (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  knight_id text unique not null
    check (knight_id in ('redhood', 'redrobin', 'nightwing', 'batgirl'))
);

-- Resolves the caller's knight id, or null if they are not a knight.
-- SECURITY DEFINER so policies can consult the map without granting knights
-- direct read access to it. search_path is pinned: an unpinned search_path on a
-- definer function is a privilege-escalation vector.
create or replace function public.current_knight()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select knight_id from public.knights where user_id = auth.uid()
$$;


-- 2. Board tables -------------------------------------------------------------
-- Column names are snake_case here and mapped to camelCase in the client
-- adapter (src/lib/storage/supabaseBoardStorage.ts). Ids are text, not uuid,
-- because the client generates them so the board can update optimistically.

create table if not exists public.cases (
  id         text primary key,
  title      text not null,
  synopsis   text not null default '',
  status     text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SOLVED', 'ARCHIVED', 'STALLED')),
  created_at timestamptz not null default now(),
  color_tag  text,
  notes      text not null default '',
  created_by text
);

create table if not exists public.evidence_nodes (
  id         text primary key,
  case_id    text not null references public.cases(id) on delete cascade,
  type       text not null check (type in ('photo', 'text', 'link', 'file')),
  content    text not null default '',
  title      text,
  notes      text not null default '',
  x          double precision not null,
  y          double precision not null,
  width      double precision,
  height     double precision,
  color      text,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.evidence_connections (
  id           text primary key,
  case_id      text not null references public.cases(id) on delete cascade,
  from_node_id text not null references public.evidence_nodes(id) on delete cascade,
  to_node_id   text not null references public.evidence_nodes(id) on delete cascade,
  label        text,
  created_by   text
);

create index if not exists evidence_nodes_case_id_idx
  on public.evidence_nodes (case_id);
create index if not exists evidence_connections_case_id_idx
  on public.evidence_connections (case_id);


-- 3. Server-authoritative attribution -----------------------------------------
-- created_by is set from the session, never from the request body, so a knight
-- cannot place evidence under someone else's sigil by editing the payload. On
-- update the original author is preserved, making attribution immutable.

create or replace function public.stamp_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := public.current_knight();
    if new.created_by is null then
      raise exception 'no knight mapped to auth.uid() %', auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end
$$;

drop trigger if exists stamp_created_by on public.cases;
create trigger stamp_created_by
  before insert or update on public.cases
  for each row execute function public.stamp_created_by();

drop trigger if exists stamp_created_by on public.evidence_nodes;
create trigger stamp_created_by
  before insert or update on public.evidence_nodes
  for each row execute function public.stamp_created_by();

drop trigger if exists stamp_created_by on public.evidence_connections;
create trigger stamp_created_by
  before insert or update on public.evidence_connections
  for each row execute function public.stamp_created_by();


-- 4. Row Level Security -------------------------------------------------------
-- With RLS on and no policy for a role, that role gets nothing. anon therefore
-- has no access to any of this, which is what makes the public anon key safe.
-- Every board policy additionally requires current_knight() is not null, so a
-- non-knight account is inert even if one exists.

alter table public.knights              enable row level security;
alter table public.cases                enable row level security;
alter table public.evidence_nodes       enable row level security;
alter table public.evidence_connections enable row level security;

-- Belt and braces: Supabase grants table privileges to anon by default. RLS
-- already blocks it, but removing the grant means a future policy mistake
-- cannot accidentally expose these tables to the public key.
revoke all on public.knights              from anon;
revoke all on public.cases                from anon;
revoke all on public.evidence_nodes       from anon;
revoke all on public.evidence_connections from anon;

-- knights: a knight may read only their own mapping, and nobody may write it
-- through the API. Seed it yourself in the SQL editor (section 6).
drop policy if exists "knight reads own mapping" on public.knights;
create policy "knight reads own mapping" on public.knights
  for select to authenticated
  using (user_id = auth.uid());

-- Board tables: the four knights share one board, so any knight may read and
-- write any row. Attribution is recorded, not used for access control -- this
-- is a shared corkboard, not per-user storage.
do $$
declare t text;
begin
  foreach t in array array['cases', 'evidence_nodes', 'evidence_connections'] loop
    execute format('drop policy if exists "knights read %1$s" on public.%1$I', t);
    execute format($p$
      create policy "knights read %1$s" on public.%1$I
        for select to authenticated
        using (public.current_knight() is not null)
    $p$, t);

    execute format('drop policy if exists "knights insert %1$s" on public.%1$I', t);
    execute format($p$
      create policy "knights insert %1$s" on public.%1$I
        for insert to authenticated
        with check (public.current_knight() is not null)
    $p$, t);

    execute format('drop policy if exists "knights update %1$s" on public.%1$I', t);
    execute format($p$
      create policy "knights update %1$s" on public.%1$I
        for update to authenticated
        using (public.current_knight() is not null)
        with check (public.current_knight() is not null)
    $p$, t);

    execute format('drop policy if exists "knights delete %1$s" on public.%1$I', t);
    execute format($p$
      create policy "knights delete %1$s" on public.%1$I
        for delete to authenticated
        using (public.current_knight() is not null)
    $p$, t);
  end loop;
end
$$;


-- 5. Realtime -----------------------------------------------------------------
-- Needed for the multiplayer board. Realtime honours the RLS policies above,
-- so non-knights receive no change events either.

do $$
begin
  alter publication supabase_realtime add table public.cases;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.evidence_nodes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.evidence_connections;
exception when duplicate_object then null;
end $$;


-- 6. Seed the knight map ------------------------------------------------------
-- Create the four users FIRST (Dashboard -> Authentication -> Users -> Add user
-- -> "Auto Confirm User" ON), then run this. It matches on the email you used.
-- Re-runnable: on conflict it just refreshes the mapping.

insert into public.knights (user_id, knight_id)
select id,
       case email
         when 'redhood@belfry.local'   then 'redhood'
         when 'redrobin@belfry.local'  then 'redrobin'
         when 'nightwing@belfry.local' then 'nightwing'
         when 'batgirl@belfry.local'   then 'batgirl'
       end
from auth.users
where email in (
  'redhood@belfry.local',
  'redrobin@belfry.local',
  'nightwing@belfry.local',
  'batgirl@belfry.local'
)
on conflict (user_id) do update set knight_id = excluded.knight_id;

-- Verify: should return exactly four rows.
select k.knight_id, u.email
from public.knights k
join auth.users u on u.id = k.user_id
order by k.knight_id;
