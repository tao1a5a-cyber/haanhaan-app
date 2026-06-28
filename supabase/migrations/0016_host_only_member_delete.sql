-- ============================================================
-- HaanHaan migration 0016 — Only the Host may remove members
-- ============================================================
-- Previously `members_all_in_group` (0014) allowed any group member to delete
-- members. This restricts DELETE on members to the group's Host, while keeping
-- SELECT / INSERT / UPDATE open to everyone in the group (so people can still
-- join, rename themselves, claim their email, etc.).
--
-- Safe to re-run. Apply after 0014.

-- Host predicate (SECURITY DEFINER so the groups lookup bypasses RLS).
create or replace function public.is_group_host(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.host_user_id = auth.uid()
  );
$$;

grant execute on function public.is_group_host(uuid) to anon, authenticated;

-- Replace the single FOR ALL members policy with per-command policies.
drop policy if exists "members_all_in_group"    on public.members;
drop policy if exists "members_select_in_group"  on public.members;
drop policy if exists "members_insert_in_group"  on public.members;
drop policy if exists "members_update_in_group"  on public.members;
drop policy if exists "members_delete_host"      on public.members;

create policy "members_select_in_group" on public.members
  for select using (public.is_group_member(group_id));

create policy "members_insert_in_group" on public.members
  for insert with check (public.is_group_member(group_id));

create policy "members_update_in_group" on public.members
  for update using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- DELETE: Host only.
create policy "members_delete_host" on public.members
  for delete using (public.is_group_host(group_id));
