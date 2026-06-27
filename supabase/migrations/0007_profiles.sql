-- ============================================================
-- Profile Identity: a per-Home display name (and color/avatar) so members
-- of a shared ledger know who created each entry.
-- One profile per (user_id, home_id). Idempotent + re-runnable.
-- ============================================================

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  home_id      uuid not null references public.homes (id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  color        text,                       -- pastel tint (any CSS color)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, home_id)
);
create index if not exists profiles_home_idx on public.profiles (home_id);

-- ── Ensure a member has a profile in a Home (default name from email) ──
create or replace function public.ensure_profile(p_home uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select coalesce(nullif(split_part(email, '@', 1), ''), 'Member')
    into v_name from auth.users where id = p_user;
  insert into public.profiles (user_id, home_id, display_name)
  values (p_user, p_home, v_name)
  on conflict (user_id, home_id) do nothing;
end $$;

-- ── Hook into onboarding: personal Home gets a profile ───
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_home uuid;
begin
  if exists (select 1 from public.admin_emails where email = new.email) then
    insert into public.admins (user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;

  insert into public.homes (name, owner_user_id) values ('My Home', new.id) returning id into v_home;
  insert into public.home_members (home_id, user_id, role) values (v_home, new.id, 'owner');
  perform public.seed_default_accounts(v_home, new.id);
  perform public.ensure_profile(v_home, new.id);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Hook into invite acceptance: joining a Home gets a profile ──
create or replace function public.join_home_by_token(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_home uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_home from public.homes where invite_token = p_token;
  if v_home is null then raise exception 'invalid invite'; end if;
  insert into public.home_members (home_id, user_id, role)
  values (v_home, v_uid, 'member') on conflict do nothing;
  perform public.ensure_profile(v_home, v_uid);
  return v_home;
end $$;

-- ── Backfill profiles for every existing membership ──────
do $$
declare m record;
begin
  for m in select home_id, user_id from public.home_members loop
    perform public.ensure_profile(m.home_id, m.user_id);
  end loop;
end $$;

-- ── RLS: members read all profiles in their Home; edit only your own ──
alter table public.profiles enable row level security;

drop policy if exists profiles_home_read on public.profiles;
create policy profiles_home_read on public.profiles
  for select using (public.is_home_member(home_id));

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for all using (user_id = auth.uid() and public.is_home_member(home_id))
  with check (user_id = auth.uid() and public.is_home_member(home_id));
