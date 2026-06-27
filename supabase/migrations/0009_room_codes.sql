-- ============================================================
-- HaanHaan migration 0009 — Room Codes
-- Adds a short, human-typable Room Code to each group so a Host can
-- share one group with guests who enter the code on the login page.
-- The code is linked to its owner via the existing groups.host_user_id.
-- Safe + idempotent: re-runnable any time.
-- ============================================================

-- ── Room code column ─────────────────────────────────────
-- Minted lazily by the app (lib/db.ts ensureRoomCode). 6 chars from an
-- unambiguous alphabet (no 0/O/1/I). Null until the Host generates one.
alter table public.groups
  add column if not exists room_code text;

-- One code → one group. Partial index lets many groups stay null.
create unique index if not exists groups_room_code_idx
  on public.groups (room_code)
  where room_code is not null;

-- ── RLS note ─────────────────────────────────────────────
-- The existing permissive "household_groups" policy (for all using(true))
-- already lets the anon role read a group by its room_code and read/write
-- that group's members + transactions, which is what guest room access needs.
-- For a stricter multi-tenant lock-down, scope policies to membership of the
-- group whose room_code was presented (e.g. via a SECURITY DEFINER lookup).
