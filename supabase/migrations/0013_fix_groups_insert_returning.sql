-- ============================================================
-- HaanHaan migration 0013 — Fix group creation under strict RLS
-- ============================================================
-- Symptom: creating a group failed with 42501
--   "new row violates row-level security policy for table groups".
--
-- Root cause: the client inserts with `?select=*` (INSERT ... RETURNING). For
-- the RETURNING rows, Postgres also evaluates the SELECT policy. The old
-- `groups_select_member` policy called `is_group_member(id)`, a STABLE SECURITY
-- DEFINER function that queries the `groups` table itself. A STABLE function
-- uses the statement's snapshot, so it CANNOT see the row being inserted by the
-- very same statement → the host check `exists(... groups.id = new_id ...)`
-- returns false → the RETURNING select is denied → 42501. (The INSERT WITH
-- CHECK itself was fine.)
--
-- Fix: the SELECT policy checks the row's own `host_user_id` column DIRECTLY
-- (always visible to the policy, no snapshot/self-query problem) and only uses
-- subqueries for the OTHER tables (members, room_access), which don't have the
-- self-reference issue. Also (re)assert the host-stamping trigger so a freshly
-- created group is always owned by its creator.
--
-- Safe to re-run. Apply after 0010 (and 0012).

-- ── 1. Host-stamping trigger (always stamp the creator) ──────────────────
create or replace function public.set_group_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.host_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists groups_set_host on public.groups;
create trigger groups_set_host
  before insert on public.groups
  for each row execute function public.set_group_host();

-- ── 2. SELECT policy without the self-referential function ───────────────
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (
    host_user_id = auth.uid()
    or exists (
      select 1 from public.members m
      where m.group_id = id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.room_access r
      where r.group_id = id and r.user_id = auth.uid()
    )
  );

-- ── 3. INSERT policy — host is forced correct by the trigger above ───────
drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (auth.uid() is not null);
