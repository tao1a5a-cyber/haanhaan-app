-- ============================================================
-- HaanHaan migration 0011 — Rate-limit join_room() (anti brute-force)
-- ============================================================
-- The Room Code keyspace is 32^6 ≈ 1.07e9, but join_room() (migration 0010)
-- had NO throttle: a client could call rpc('join_room', …) in a loop and
-- enumerate codes. This migration adds a server-side rate limit that lives
-- ENTIRELY inside join_room(), so:
--
--   • The frontend is unchanged — it still calls rpc('join_room', {p_code}).
--     The function keeps the same signature: join_room(text) returns uuid.
--   • A normal user who types the correct code once is NEVER affected
--     (only FAILED attempts count toward the limit).
--   • An attacker looping guesses gets blocked after a handful of misses,
--     both per auth-uid AND per source IP (so spinning up fresh anonymous
--     uids doesn't bypass it).
--
-- Safe + idempotent: re-runnable any time. Rollback at the bottom.

-- ── Tunables ─────────────────────────────────────────────
-- Window and caps are generous enough that real households (several people
-- entering a code, the odd typo) never hit them, but kill automated guessing.
--   MAX_FAILS_PER_UID : failed guesses allowed per auth user   / window
--   MAX_FAILS_PER_IP  : failed guesses allowed per source IP   / window
--   WINDOW            : the sliding window (1 minute)
-- Edit the literals in the function body below to retune.

-- ── 1. Attempt log ───────────────────────────────────────
-- Touched only by join_room() (SECURITY DEFINER), so RLS is ON with NO
-- policies → zero direct client access. Holds only recent rows (auto-pruned).
create table if not exists public.room_join_attempts (
  id    bigint generated always as identity primary key,
  uid   uuid        not null,
  ip    text,
  ok    boolean     not null,
  at    timestamptz not null default now()
);

alter table public.room_join_attempts enable row level security;

create index if not exists room_join_attempts_uid_at_idx
  on public.room_join_attempts (uid, at);
create index if not exists room_join_attempts_ip_at_idx
  on public.room_join_attempts (ip, at);

-- ── 2. Rate-limited join_room() ──────────────────────────
-- Same name/signature as before, so it transparently replaces the old one
-- and no grant/frontend change is needed.
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id   uuid;
  v_uid        uuid := auth.uid();
  v_ip         text;
  v_since      timestamptz := now() - interval '1 minute';
  v_fail_uid   integer;
  v_fail_ip    integer;
begin
  if v_uid is null then
    raise exception 'join_room: not authenticated (sign in anonymously first)';
  end if;

  -- Source IP from the PostgREST request headers (best-effort; first hop of
  -- x-forwarded-for). Used only as a second rate-limit key, never for trust.
  begin
    v_ip := split_part(
      coalesce(
        nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
        ''
      ), ',', 1
    );
  exception when others then
    v_ip := null;
  end;
  v_ip := nullif(trim(v_ip), '');

  -- Opportunistic prune so the log can't grow unbounded (cheap, index-backed).
  if random() < 0.02 then
    delete from public.room_join_attempts where at < now() - interval '1 day';
  end if;

  -- Count recent FAILED attempts for this uid and this IP.
  select count(*) into v_fail_uid
  from public.room_join_attempts
  where uid = v_uid and ok = false and at >= v_since;

  select count(*) into v_fail_ip
  from public.room_join_attempts
  where v_ip is not null and ip = v_ip and ok = false and at >= v_since;

  -- MAX_FAILS_PER_UID = 8, MAX_FAILS_PER_IP = 30  (per 1-minute window)
  if v_fail_uid >= 8 or v_fail_ip >= 30 then
    -- Don't reveal the throttle; the frontend already maps this to the same
    -- "ไม่พบห้องนี้" message as an unknown code. No data leaks either way.
    raise exception 'join_room: rate limit exceeded, slow down';
  end if;

  -- Look up the group by code (bypasses RLS via SECURITY DEFINER).
  select id into v_group_id
  from public.groups
  where room_code = upper(trim(p_code));

  -- Log the attempt (ok = found a group).
  insert into public.room_join_attempts (uid, ip, ok)
  values (v_uid, v_ip, v_group_id is not null);

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

-- ============================================================================
-- ROLLBACK (restore the un-throttled join_room) — uncomment and run if needed:
-- ============================================================================
-- create or replace function public.join_room(p_code text)
-- returns uuid language plpgsql security definer set search_path = public as $$
-- declare v_group_id uuid; v_uid uuid := auth.uid();
-- begin
--   if v_uid is null then raise exception 'join_room: not authenticated'; end if;
--   select id into v_group_id from public.groups where room_code = upper(trim(p_code));
--   if v_group_id is null then return null; end if;
--   insert into public.room_access (group_id, user_id) values (v_group_id, v_uid)
--     on conflict (group_id, user_id) do nothing;
--   return v_group_id;
-- end; $$;
-- drop table if exists public.room_join_attempts;
