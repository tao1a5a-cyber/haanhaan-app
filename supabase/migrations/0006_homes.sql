-- ============================================================
-- Homes: shareable namespace for the double-entry ledger.
-- "One Email = One Home" — each new user auto-gets a personal Home and
-- starter accounts. Homes can be shared via invite token (friend/family).
-- accounts + dde_transactions are scoped by home_id; RLS checks membership.
-- Idempotent + re-runnable.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Homes + membership ───────────────────────────────────
create table if not exists public.homes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Home',
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  invite_token  text not null unique default encode(gen_random_bytes(8), 'hex'),
  created_at    timestamptz not null default now()
);

create table if not exists public.home_members (
  home_id   uuid not null references public.homes (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member',  -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (home_id, user_id)
);
create index if not exists home_members_user_idx on public.home_members (user_id);

-- ── Membership helpers (security definer → no RLS recursion) ──
create or replace function public.is_home_member(p_home uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.home_members where home_id = p_home and user_id = auth.uid());
$$;

create or replace function public.is_home_owner(p_home uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.homes where id = p_home and owner_user_id = auth.uid());
$$;

-- ── Add home_id to ledger tables ─────────────────────────
alter table public.accounts        add column if not exists home_id uuid references public.homes (id) on delete cascade;
alter table public.dde_transactions add column if not exists home_id uuid references public.homes (id) on delete cascade;
create index if not exists accounts_home_idx on public.accounts (home_id);
create index if not exists dde_tx_home_idx   on public.dde_transactions (home_id);

-- ── Seed a home's default chart of accounts ──────────────
-- Drop the superseded single-arg version from migration 0005 (different
-- signature ⇒ Postgres keeps it as a separate overload otherwise).
drop function if exists public.seed_default_accounts(uuid);

create or replace function public.seed_default_accounts(p_home uuid, p_user uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.accounts (user_id, home_id, name, type) values
    (p_user, p_home, 'Cash',            'asset'),
    (p_user, p_home, 'Bank',            'asset'),
    (p_user, p_home, 'Expenses',        'expense'),
    (p_user, p_home, 'Income',          'income'),
    (p_user, p_home, 'Opening Balance', 'equity')
  on conflict do nothing;
$$;

-- ── New-user onboarding: admin promo + personal Home + accounts ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_home uuid;
begin
  if exists (select 1 from public.admin_emails where email = new.email) then
    insert into public.admins (user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;

  -- One Email = One Home.
  insert into public.homes (name, owner_user_id) values ('My Home', new.id) returning id into v_home;
  insert into public.home_members (home_id, user_id, role) values (v_home, new.id, 'owner');
  perform public.seed_default_accounts(v_home, new.id);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Join a Home via invite token (security definer) ──────
-- The invited user calls this; it validates the token and adds them.
create or replace function public.join_home_by_token(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_home uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_home from public.homes where invite_token = p_token;
  if v_home is null then raise exception 'invalid invite'; end if;
  insert into public.home_members (home_id, user_id, role)
  values (v_home, v_uid, 'member') on conflict do nothing;
  return v_home;
end $$;

-- ── Backfill: give each existing user a personal Home ────
do $$
declare u record; h uuid;
begin
  for u in select distinct id from auth.users loop
    select id into h from public.homes where owner_user_id = u.id order by created_at limit 1;
    if h is null then
      insert into public.homes (name, owner_user_id) values ('My Home', u.id) returning id into h;
    end if;
    insert into public.home_members (home_id, user_id, role) values (h, u.id, 'owner')
      on conflict do nothing;
    update public.accounts        set home_id = h where user_id = u.id and home_id is null;
    update public.dde_transactions set home_id = h where user_id = u.id and home_id is null;
    perform public.seed_default_accounts(h, u.id);
  end loop;
end $$;

-- ── Swap accounts uniqueness to be per-Home ──────────────
alter table public.accounts drop constraint if exists accounts_user_id_name_key;
do $$ begin
  alter table public.accounts add constraint accounts_home_name_key unique (home_id, name);
exception when duplicate_object then null; end $$;

-- ── Home-aware ACID posting RPC ──────────────────────────
create or replace function public.post_transaction(
  p_home_id     uuid,
  p_description text,
  p_legs        jsonb,
  p_date        date default current_date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tx_id uuid;
  v_dr numeric(14,2);
  v_cr numeric(14,2);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.is_home_member(p_home_id) then raise exception 'not a member of this home'; end if;
  if jsonb_array_length(p_legs) < 2 then raise exception 'a transaction needs at least two legs'; end if;

  -- Every leg's account must belong to THIS home.
  if exists (
    select 1 from jsonb_array_elements(p_legs) l
    left join public.accounts a on a.id = (l->>'account_id')::uuid and a.home_id = p_home_id
    where a.id is null
  ) then raise exception 'unknown account or wrong home'; end if;

  select coalesce(sum(amount) filter (where type='Dr'),0),
         coalesce(sum(amount) filter (where type='Cr'),0)
    into v_dr, v_cr
  from (
    select (l->>'type')::dr_cr type, (l->>'amount')::numeric amount
    from jsonb_array_elements(p_legs) l
  ) s;

  if v_dr <> v_cr then raise exception 'unbalanced: Dr % <> Cr %', v_dr, v_cr; end if;

  insert into public.dde_transactions (user_id, home_id, date, description)
  values (v_uid, p_home_id, p_date, p_description) returning id into v_tx_id;

  insert into public.journal_entries (transaction_id, account_id, type, amount)
  select v_tx_id, (l->>'account_id')::uuid, (l->>'type')::dr_cr, (l->>'amount')::numeric
  from jsonb_array_elements(p_legs) l;

  return v_tx_id;
end $$;

-- ── RLS: strict per-Home isolation ───────────────────────
alter table public.homes           enable row level security;
alter table public.home_members    enable row level security;
alter table public.accounts        enable row level security;
alter table public.dde_transactions enable row level security;
alter table public.journal_entries enable row level security;

-- Homes: members can read; owner manages; any authed user can create their own.
drop policy if exists homes_member_read on public.homes;
create policy homes_member_read on public.homes
  for select using (public.is_home_member(id) or owner_user_id = auth.uid());
drop policy if exists homes_owner_insert on public.homes;
create policy homes_owner_insert on public.homes
  for insert with check (owner_user_id = auth.uid());
drop policy if exists homes_owner_manage on public.homes;
create policy homes_owner_manage on public.homes
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
drop policy if exists homes_owner_delete on public.homes;
create policy homes_owner_delete on public.homes
  for delete using (owner_user_id = auth.uid());

-- Home members: members see the roster; owner adds/removes (joining is via RPC).
drop policy if exists home_members_read on public.home_members;
create policy home_members_read on public.home_members
  for select using (public.is_home_member(home_id));
drop policy if exists home_members_owner_write on public.home_members;
create policy home_members_owner_write on public.home_members
  for all using (public.is_home_owner(home_id)) with check (public.is_home_owner(home_id));

-- Accounts: any member of the home.
drop policy if exists accounts_owner on public.accounts;          -- old per-user policy
drop policy if exists accounts_home on public.accounts;
create policy accounts_home on public.accounts
  for all using (public.is_home_member(home_id)) with check (public.is_home_member(home_id));

-- Transactions: any member (admins may read all).
drop policy if exists tx_owner on public.dde_transactions;        -- old per-user policy
drop policy if exists tx_home on public.dde_transactions;
create policy tx_home on public.dde_transactions
  for all using (public.is_home_member(home_id) or public.is_admin())
  with check (public.is_home_member(home_id));

-- Journal entries: scoped through their parent transaction's home.
drop policy if exists je_owner on public.journal_entries;         -- old per-user policy
drop policy if exists je_home on public.journal_entries;
create policy je_home on public.journal_entries
  for all using (exists (
    select 1 from public.dde_transactions t
    where t.id = transaction_id and (public.is_home_member(t.home_id) or public.is_admin())
  )) with check (exists (
    select 1 from public.dde_transactions t
    where t.id = transaction_id and public.is_home_member(t.home_id)
  ));
