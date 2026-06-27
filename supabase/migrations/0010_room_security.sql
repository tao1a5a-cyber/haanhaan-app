-- ============================================================
-- HaanHaan migration 0010 — Tighter RLS for groups & Room Codes
-- ============================================================
-- Replaces the permissive "household_*" (using(true)) policies with
-- membership-scoped access:
--
--   • A logged-in user can only touch groups they HOST or are a MEMBER of.
--   • A guest can only touch a group they were GRANTED access to by
--     presenting its Room Code (via the join_room() function below).
--   • Nobody can read another group's data with just the anon key.
--
-- ┌─ READ THIS BEFORE APPLYING ───────────────────────────────────────────┐
-- │ This migration changes the security model and MUST be applied together │
-- │ with the matching frontend/auth changes, or the app will lock itself   │
-- │ out. Specifically:                                                     │
-- │                                                                        │
-- │  1. Enable "Anonymous sign-ins":                                       │
-- │       Supabase Dashboard → Authentication → Sign In / Providers →      │
-- │       toggle "Allow anonymous sign-ins" ON.                            │
-- │     Guests need a real (anonymous) auth uid for membership RLS to work.│
-- │                                                                        │
-- │  2. Room access must go through join_room() (SECURITY DEFINER), not a  │
-- │     direct `select … from groups where room_code = …`. The login-page  │
-- │     "enter Room Code" flow becomes:                                     │
-- │        await supabase.auth.signInAnonymously()                         │
-- │        const { data: gid } = await supabase.rpc('join_room',           │
-- │                                                  { p_code: code })      │
-- │     A null gid means "invalid code".                                   │
-- │                                                                        │
-- │  3. Existing groups created with a NULL host_user_id and no claimed    │
-- │     member become invisible (no one satisfies membership). Backfill    │
-- │     host_user_id for any such groups before applying (see the optional │
-- │     backfill block at the bottom), or claim a member in each first.    │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- A rollback script is at the very bottom (commented out).

-- ── 0. Grant table (who may access which group via a code) ───────────────
-- Kept separate from `members` so room guests don't pollute a group's
-- member list. Touched only by the SECURITY DEFINER functions below, so it
-- has RLS enabled with NO policies → no direct client access at all.
create table if not exists public.room_access (
  group_id   uuid        not null references public.groups (id) on delete cascade,
  user_id    uuid        not null references auth.users (id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.room_access enable row level security;

-- ── 1. Membership predicate ──────────────────────────────────────────────
-- True when the current auth user hosts `gid`, is a member of it, or has a
-- room-code grant for it. SECURITY DEFINER so its internal reads bypass RLS
-- (this is what prevents infinite recursion inside the members policies).
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select true
    where auth.uid() is not null and (
      exists (select 1 from public.groups      g where g.id = gid       and g.host_user_id = auth.uid())
      or exists (select 1 from public.members  m where m.group_id = gid and m.user_id      = auth.uid())
      or exists (select 1 from public.room_access r where r.group_id = gid and r.user_id   = auth.uid())
    )
  ), false);
$$;

grant execute on function public.is_group_member(uuid) to anon, authenticated;

-- ── 2. join_room(code): the ONLY way a guest gains access to a group ─────
-- Looks up the group by code (bypassing RLS), records a grant for the
-- current (anonymous or real) auth user, and returns the group id.
-- Returns NULL for an unknown code. Requires the caller to be signed in
-- (anonymous sign-in counts).
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_uid      uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'join_room: not authenticated (sign in anonymously first)';
  end if;

  select id into v_group_id
  from public.groups
  where room_code = upper(trim(p_code));

  if v_group_id is null then
    return null;  -- invalid / unknown code
  end if;

  insert into public.room_access (group_id, user_id)
  values (v_group_id, v_uid)
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

grant execute on function public.join_room(text) to anon, authenticated;

-- ── 3. Auto-stamp the creator as host ────────────────────────────────────
-- So a freshly-created group is owned by whoever made it, even though the
-- frontend's createGroup() doesn't pass host_user_id explicitly.
create or replace function public.set_group_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_user_id is null then
    new.host_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists groups_set_host on public.groups;
create trigger groups_set_host
  before insert on public.groups
  for each row execute function public.set_group_host();

-- ── 4. Replace permissive policies with scoped ones ──────────────────────

-- groups ------------------------------------------------------------------
drop policy if exists "household_groups" on public.groups;

create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id));

create policy "groups_insert_own" on public.groups
  for insert with check (auth.uid() is not null and host_user_id = auth.uid());

create policy "groups_update_host" on public.groups
  for update using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());

create policy "groups_delete_host" on public.groups
  for delete using (host_user_id = auth.uid());

-- members -----------------------------------------------------------------
drop policy if exists "household_members" on public.members;

create policy "members_all_in_group" on public.members
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- transactions ------------------------------------------------------------
drop policy if exists "household_transactions" on public.transactions;

create policy "transactions_all_in_group" on public.transactions
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- notifications -----------------------------------------------------------
drop policy if exists "household_notifications" on public.notifications;

create policy "notifications_all_in_group" on public.notifications
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- custom_categories -------------------------------------------------------
-- Scoped through the owning member's group. Legacy global rows (member_id
-- null) stay readable to any signed-in user but can't be created anymore.
drop policy if exists "household_categories" on public.custom_categories;

create policy "categories_select" on public.custom_categories
  for select using (
    member_id is null
    or exists (
      select 1 from public.members m
      where m.id = custom_categories.member_id and public.is_group_member(m.group_id)
    )
  );

create policy "categories_write" on public.custom_categories
  for all using (
    member_id is not null and exists (
      select 1 from public.members m
      where m.id = custom_categories.member_id and public.is_group_member(m.group_id)
    )
  ) with check (
    member_id is not null and exists (
      select 1 from public.members m
      where m.id = custom_categories.member_id and public.is_group_member(m.group_id)
    )
  );

-- ── 5. (Optional) Backfill host for orphaned groups ──────────────────────
-- If you have groups with a null host_user_id but a member already bound to
-- your account, adopt the earliest such member's user as host. Review before
-- running — uncomment to use.
--
-- update public.groups g
--   set host_user_id = sub.user_id
--   from (
--     select distinct on (group_id) group_id, user_id
--     from public.members
--     where user_id is not null
--     order by group_id, created_at
--   ) sub
--   where g.id = sub.group_id and g.host_user_id is null;

-- ============================================================================
-- ROLLBACK (restore the permissive model) — uncomment and run if needed:
-- ============================================================================
-- drop policy if exists "groups_select_member"        on public.groups;
-- drop policy if exists "groups_insert_own"           on public.groups;
-- drop policy if exists "groups_update_host"          on public.groups;
-- drop policy if exists "groups_delete_host"          on public.groups;
-- drop policy if exists "members_all_in_group"        on public.members;
-- drop policy if exists "transactions_all_in_group"   on public.transactions;
-- drop policy if exists "notifications_all_in_group"  on public.notifications;
-- drop policy if exists "categories_select"           on public.custom_categories;
-- drop policy if exists "categories_write"            on public.custom_categories;
-- drop trigger if exists groups_set_host on public.groups;
-- create policy "household_groups"        on public.groups            for all using (true) with check (true);
-- create policy "household_members"       on public.members           for all using (true) with check (true);
-- create policy "household_transactions"  on public.transactions      for all using (true) with check (true);
-- create policy "household_notifications" on public.notifications     for all using (true) with check (true);
-- create policy "household_categories"    on public.custom_categories for all using (true) with check (true);
