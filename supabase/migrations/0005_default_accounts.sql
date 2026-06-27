-- ============================================================
-- "One Email = One Home" — per-user namespace bootstrapping
-- Every new user is auto-provisioned their OWN independent set of
-- default accounts on first login. RLS (from 0004) already guarantees a
-- user can only ever touch rows where user_id = auth.uid().
-- Idempotent + re-runnable.
-- ============================================================

-- ── Seed a fresh user's default chart of accounts ────────
-- Safe to call repeatedly: unique(user_id, name) + on conflict do nothing.
create or replace function public.seed_default_accounts(p_user uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.accounts (user_id, name, type) values
    (p_user, 'Cash',            'asset'),
    (p_user, 'Bank',            'asset'),
    (p_user, 'Expenses',        'expense'),
    (p_user, 'Income',          'income'),
    (p_user, 'Opening Balance', 'equity')
  on conflict (user_id, name) do nothing;
$$;

-- ── Extend the new-user trigger to seed the home ─────────
-- Keeps the existing admin-promotion logic and adds account seeding.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admin promotion (allow-listed emails).
  if exists (select 1 from public.admin_emails where email = new.email) then
    insert into public.admins (user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;

  -- One Email = One Home: give this user their own starter accounts.
  perform public.seed_default_accounts(new.id);

  return new;
end $$;

-- Trigger already exists from 0004; recreate to be safe.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill: seed accounts for any existing users ───────
-- Covers users who signed up before this migration.
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_accounts(u.id);
  end loop;
end $$;

-- ── RLS sanity (owner-only) — reaffirm from 0004 ─────────
-- These are no-ops if already enabled; kept here as the single source of
-- truth for the "users only see their own home" guarantee.
alter table public.accounts        enable row level security;
alter table public.dde_transactions enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists accounts_owner on public.accounts;
create policy accounts_owner on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
