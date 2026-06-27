-- ============================================================
-- HaanHaan: income vs expense.
-- Adds `kind` to transactions so an entry can be money OUT (expense, default)
-- or shared earnings split among members (income). Idempotent.
-- ============================================================

alter table public.transactions
  add column if not exists kind text not null default 'expense'
  check (kind in ('expense', 'income'));
