-- ============================================================
-- HaanHaan migration 0014 — Revert the guest read-only model (0012)
-- ============================================================
-- 0012 split each table's policy into SELECT (anyone with access) + write
-- (is_group_writer, which excluded anonymous sessions). That extra complexity
-- caused access regressions, so this migration restores the simpler model from
-- 0010: anyone with access to a group (host, member, or room-code grant) can
-- read AND write within it. The "read-only for anonymous guests" feature is
-- removed entirely.
--
-- Keeps migration 0013's groups policies untouched (the INSERT…RETURNING fix).
-- Safe to re-run. Apply after 0012/0013.

-- ── members ──────────────────────────────────────────────────────────────
drop policy if exists "members_select_in_group" on public.members;
drop policy if exists "members_insert_in_group" on public.members;
drop policy if exists "members_update_in_group" on public.members;
drop policy if exists "members_delete_in_group" on public.members;
drop policy if exists "members_all_in_group"    on public.members;

create policy "members_all_in_group" on public.members
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- ── transactions ─────────────────────────────────────────────────────────
drop policy if exists "transactions_select_in_group" on public.transactions;
drop policy if exists "transactions_insert_in_group" on public.transactions;
drop policy if exists "transactions_update_in_group" on public.transactions;
drop policy if exists "transactions_delete_in_group" on public.transactions;
drop policy if exists "transactions_all_in_group"    on public.transactions;

create policy "transactions_all_in_group" on public.transactions
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- ── notifications ────────────────────────────────────────────────────────
drop policy if exists "notifications_select_in_group" on public.notifications;
drop policy if exists "notifications_insert_in_group" on public.notifications;
drop policy if exists "notifications_update_in_group" on public.notifications;
drop policy if exists "notifications_delete_in_group" on public.notifications;
drop policy if exists "notifications_all_in_group"    on public.notifications;

create policy "notifications_all_in_group" on public.notifications
  for all using (public.is_group_member(group_id))
          with check (public.is_group_member(group_id));

-- ── custom_categories — write policy back to membership (not writer) ──────
drop policy if exists "categories_write" on public.custom_categories;
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

-- ── drop the now-unused writer predicate ─────────────────────────────────
drop function if exists public.is_group_writer(uuid);
