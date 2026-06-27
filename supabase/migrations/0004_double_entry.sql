-- ============================================================
-- Double-Entry Bookkeeping – core schema
-- Auth: Google OAuth + Email Magic Link (configured in dashboard)
-- Enforces: balanced Dr/Cr, ACID posting, per-user RLS, admin role.
-- Idempotent + re-runnable. Header table is `dde_transactions` to avoid
-- colliding with the existing HaanHaan `public.transactions` table.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Admins ───────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email   text not null,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Allow-list of emails that should become admins (a table, since Supabase
-- does not let the SQL Editor role set database-level GUC parameters).
create table if not exists public.admin_emails (
  email text primary key
);
-- Seed at least one Host/Admin. REQUIRED.
insert into public.admin_emails (email) values ('juatafilm@gmail.com')
on conflict do nothing;

-- Auto-promote allow-listed emails on first login.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admin_emails where email = new.email) then
    insert into public.admins (user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Promote the host now, in case they've already signed in.
insert into public.admins (user_id, email)
select u.id, u.email from auth.users u
join public.admin_emails a on a.email = u.email
on conflict (user_id) do nothing;

-- ── Chart of accounts ────────────────────────────────────
-- Each user has their own ledger of accounts (Cash, Bank, Food, Salary…).
do $$ begin
  create type account_type as enum ('asset','liability','equity','income','expense');
exception when duplicate_object then null; end $$;

create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  type       account_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists accounts_user_idx on public.accounts (user_id);

-- ── Transactions (the journal header) ────────────────────
create table if not exists public.dde_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null default current_date,
  description text not null,
  created_at  timestamptz not null default now()
);
create index if not exists dde_tx_user_idx on public.dde_transactions (user_id, date desc);

-- ── Journal entries (the legs) ───────────────────────────
do $$ begin
  create type dr_cr as enum ('Dr','Cr');
exception when duplicate_object then null; end $$;

create table if not exists public.journal_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.dde_transactions (id) on delete cascade,
  account_id     uuid not null references public.accounts (id),
  type           dr_cr  not null,
  amount         numeric(14,2) not null check (amount > 0)
);
create index if not exists journal_tx_idx on public.journal_entries (transaction_id);
create index if not exists journal_account_idx on public.journal_entries (account_id);

-- ── ACID posting RPC ─────────────────────────────────────
-- Inserts a transaction + all legs atomically and REJECTS the whole
-- thing unless total Dr = total Cr. Any error rolls everything back.
-- legs jsonb: [{"account_id": "...", "type": "Dr", "amount": 100}, ...]
create or replace function public.post_transaction(
  p_description text,
  p_legs        jsonb,
  p_date        date default current_date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_tx_id uuid;
  v_dr    numeric(14,2);
  v_cr    numeric(14,2);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if jsonb_array_length(p_legs) < 2 then
    raise exception 'a transaction needs at least two legs';
  end if;

  -- Reject legs that reference accounts the user does not own.
  if exists (
    select 1 from jsonb_array_elements(p_legs) l
    left join public.accounts a on a.id = (l->>'account_id')::uuid and a.user_id = v_uid
    where a.id is null
  ) then raise exception 'unknown or unauthorized account'; end if;

  select coalesce(sum(amount) filter (where type='Dr'),0),
         coalesce(sum(amount) filter (where type='Cr'),0)
    into v_dr, v_cr
  from (
    select (l->>'type')::dr_cr type, (l->>'amount')::numeric amount
    from jsonb_array_elements(p_legs) l
  ) s;

  if v_dr <> v_cr then
    raise exception 'unbalanced: Dr % <> Cr %', v_dr, v_cr;  -- triggers rollback
  end if;

  insert into public.dde_transactions (user_id, date, description)
  values (v_uid, p_date, p_description) returning id into v_tx_id;

  insert into public.journal_entries (transaction_id, account_id, type, amount)
  select v_tx_id, (l->>'account_id')::uuid, (l->>'type')::dr_cr, (l->>'amount')::numeric
  from jsonb_array_elements(p_legs) l;

  return v_tx_id;
end $$;

-- ── Row Level Security ───────────────────────────────────
alter table public.accounts         enable row level security;
alter table public.dde_transactions enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.admins           enable row level security;
alter table public.admin_emails     enable row level security;

-- admin_emails: readable only by admins, never written via the API.
drop policy if exists admin_emails_read on public.admin_emails;
create policy admin_emails_read on public.admin_emails
  for select using (public.is_admin());

-- Accounts: owner-only.
drop policy if exists accounts_owner on public.accounts;
create policy accounts_owner on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Transactions: owner-only (admins may read all for oversight).
drop policy if exists tx_owner on public.dde_transactions;
create policy tx_owner on public.dde_transactions
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- Journal entries: scoped through their parent transaction.
drop policy if exists je_owner on public.journal_entries;
create policy je_owner on public.journal_entries
  for all using (exists (
    select 1 from public.dde_transactions t
    where t.id = transaction_id and (t.user_id = auth.uid() or public.is_admin())
  )) with check (exists (
    select 1 from public.dde_transactions t
    where t.id = transaction_id and t.user_id = auth.uid()
  ));

-- Admins: a user can see their own admin row; admins see all.
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
  for select using (user_id = auth.uid() or public.is_admin());
