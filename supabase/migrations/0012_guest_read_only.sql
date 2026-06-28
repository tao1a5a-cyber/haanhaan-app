-- ============================================================
-- HaanHaan migration 0012 — Read-only access for anonymous guests
-- ============================================================
-- Builds on migration 0010 (strict membership RLS + Room Codes).
--
-- Goal: a visitor who joins a group with a Room Code but has NOT signed in with
-- a real account (i.e. an *anonymous* Supabase session) may BROWSE the group's
-- data but may not write to it. The moment they authenticate with a real
-- account (Google / magic link) and claim a profile, full write access returns.
--
-- How: split every permissive `FOR ALL` policy from 0010 into
--   • a SELECT policy keyed on is_group_member()  → read for anyone with access
--   • write policies (INSERT/UPDATE/DELETE) keyed on is_group_writer() → blocked
--     for anonymous sessions.
--
-- Safe to re-run (every policy is dropped-if-exists first). Apply AFTER 0010.
-- A rollback block is at the bottom (commented out).

-- ── 1. Writer predicate ──────────────────────────────────────────────────
-- True when the current auth user has access to the group (host, member, or a
-- Room-Code grant) AND is NOT an anonymous session. SECURITY DEFINER so the
-- auth.users lookup bypasses RLS. Reuses is_group_member() from 0010 for the
-- access check (which itself returns false when auth.uid() is null).
create or replace function public.is_group_writer(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_group_member(gid)
    and auth.uid() is not null
    and not coalesce(
      (select u.is_anonymous from auth.users u where u.id = auth.uid()),
      false
    );
$$;

grant execute on function public.is_group_writer(uuid) to anon, authenticated;

-- ── 2. members ───────────────────────────────────────────────────────────
-- SELECT for anyone with access; writes only for non-anonymous users. Note the
-- write check uses is_group_writer (membership-or-grant based), NOT "already a
-- member", so a freshly-joined authenticated user can still INSERT their own
-- profile and UPDATE it to claim their email.
drop policy if exists "members_all_in_group"    on public.members;
drop policy if exists "members_select_in_group"  on public.members;
drop policy if exists "members_insert_in_group"  on public.members;
drop policy if exists "members_update_in_group"  on public.members;
drop policy if exists "members_delete_in_group"  on public.members;

create policy "members_select_in_group" on public.members
  for select using (public.is_group_member(group_id));
create policy "members_insert_in_group" on public.members
  for insert with check (public.is_group_writer(group_id));
create policy "members_update_in_group" on public.members
  for update using (public.is_group_writer(group_id))
          with check (public.is_group_writer(group_id));
create policy "members_delete_in_group" on public.members
  for delete using (public.is_group_writer(group_id));

-- ── 3. transactions ──────────────────────────────────────────────────────
drop policy if exists "transactions_all_in_group"     on public.transactions;
drop policy if exists "transactions_select_in_group"  on public.transactions;
drop policy if exists "transactions_insert_in_group"  on public.transactions;
drop policy if exists "transactions_update_in_group"  on public.transactions;
drop policy if exists "transactions_delete_in_group"  on public.transactions;

create policy "transactions_select_in_group" on public.transactions
  for select using (public.is_group_member(group_id));
create policy "transactions_insert_in_group" on public.transactions
  for insert with check (public.is_group_writer(group_id));
create policy "transactions_update_in_group" on public.transactions
  for update using (public.is_group_writer(group_id))
          with check (public.is_group_writer(group_id));
create policy "transactions_delete_in_group" on public.transactions
  for delete using (public.is_group_writer(group_id));

-- ── 4. notifications ─────────────────────────────────────────────────────
drop policy if exists "notifications_all_in_group"     on public.notifications;
drop policy if exists "notifications_select_in_group"  on public.notifications;
drop policy if exists "notifications_insert_in_group"  on public.notifications;
drop policy if exists "notifications_update_in_group"  on public.notifications;
drop policy if exists "notifications_delete_in_group"  on public.notifications;

create policy "notifications_select_in_group" on public.notifications
  for select using (public.is_group_member(group_id));
create policy "notifications_insert_in_group" on public.notifications
  for insert with check (public.is_group_writer(group_id));
create policy "notifications_update_in_group" on public.notifications
  for update using (public.is_group_writer(group_id))
          with check (public.is_group_writer(group_id));
create policy "notifications_delete_in_group" on public.notifications
  for delete using (public.is_group_writer(group_id));

-- ── 5. custom_categories ─────────────────────────────────────────────────
-- SELECT stays as 0010 defined it (legacy global rows + owner's group rows).
-- The write policy is re-created to require a NON-ANONYMOUS owner.
drop policy if exists "categories_write" on public.custom_categories;

create policy "categories_write" on public.custom_categories
  for all using (
    member_id is not null and exists (
      select 1 from public.members m
      where m.id = custom_categories.member_id and public.is_group_writer(m.group_id)
    )
  ) with check (
    member_id is not null and exists (
      select 1 from public.members m
      where m.id = custom_categories.member_id and public.is_group_writer(m.group_id)
    )
  );

-- ============================================================================
-- ROLLBACK (restore the 0010 permissive FOR ALL writes) — uncomment to run:
-- ============================================================================
-- drop policy if exists "members_select_in_group"      on public.members;
-- drop policy if exists "members_insert_in_group"      on public.members;
-- drop policy if exists "members_update_in_group"      on public.members;
-- drop policy if exists "members_delete_in_group"      on public.members;
-- drop policy if exists "transactions_select_in_group" on public.transactions;
-- drop policy if exists "transactions_insert_in_group" on public.transactions;
-- drop policy if exists "transactions_update_in_group" on public.transactions;
-- drop policy if exists "transactions_delete_in_group" on public.transactions;
-- drop policy if exists "notifications_select_in_group" on public.notifications;
-- drop policy if exists "notifications_insert_in_group" on public.notifications;
-- drop policy if exists "notifications_update_in_group" on public.notifications;
-- drop policy if exists "notifications_delete_in_group" on public.notifications;
-- create policy "members_all_in_group"       on public.members       for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
-- create policy "transactions_all_in_group"  on public.transactions  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
-- create policy "notifications_all_in_group" on public.notifications for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
-- create policy "categories_write" on public.custom_categories for all
--   using (member_id is not null and exists (select 1 from public.members m where m.id = custom_categories.member_id and public.is_group_member(m.group_id)))
--   with check (member_id is not null and exists (select 1 from public.members m where m.id = custom_categories.member_id and public.is_group_member(m.group_id)));
-- drop function if exists public.is_group_writer(uuid);
