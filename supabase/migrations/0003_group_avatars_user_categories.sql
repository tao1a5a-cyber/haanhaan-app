-- ============================================================
-- HaanHaan migration 0003 — Group avatars + user-scoped categories
-- 1. Adds an avatar image to each group (stored in the public
--    'avatars' bucket, same as member avatars).
-- 2. Scopes custom categories (emoji + custom label) to the member
--    that created them, so they are no longer shared globally.
-- Safe + idempotent: re-runnable any time.
-- ============================================================

-- ── 1. Group avatar ──────────────────────────────────────
alter table public.groups
  add column if not exists avatar_url text;   -- Supabase Storage public URL ('avatars' bucket)

-- ── 2. Per-member custom categories ──────────────────────
alter table public.custom_categories
  add column if not exists member_id uuid references public.members (id) on delete cascade;

create index if not exists custom_categories_member_idx
  on public.custom_categories (member_id, sort_order);

-- Existing global categories (member_id is null) stay visible to everyone
-- as a shared fallback; newly created ones are tagged with their owner.
