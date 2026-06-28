-- ============================================================
-- HaanHaan migration 0015 — Fix room-code guests not seeing their group
-- ============================================================
-- Regression from 0013: that migration inlined the membership checks into the
-- groups SELECT policy, including `exists (select 1 from room_access ...)`. But
-- `room_access` has RLS enabled with NO policies (intentionally — only the
-- SECURITY DEFINER join_room() may touch it), so an inline subquery against it
-- from a normal client reads NOTHING. Result: a guest who redeemed a Room Code
-- could not see the group → the app bounced them to "create group".
--
-- Fix: read members + room_access through a SECURITY DEFINER helper (bypasses
-- RLS, so the grant is visible) while still checking `host_user_id = auth.uid()`
-- DIRECTLY on the row — the direct host check is what keeps INSERT…RETURNING
-- working for the creator (0013's fix), since the helper does NOT query groups
-- and therefore has no same-statement snapshot problem.
--
-- Safe to re-run. Apply after 0013/0014.

-- ── 1. Grant predicate (members + room_access only; never groups) ─────────
create or replace function public.has_group_access(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.members     m where m.group_id = gid and m.user_id = auth.uid())
    or exists (select 1 from public.room_access r where r.group_id = gid and r.user_id = auth.uid())
  );
$$;

grant execute on function public.has_group_access(uuid) to anon, authenticated;

-- ── 2. groups SELECT: host (direct) OR a member/room-code grant (helper) ──
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (
    host_user_id = auth.uid()
    or public.has_group_access(id)
  );
