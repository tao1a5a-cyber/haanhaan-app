# HaanHaan — project guide

Shared-expense tracker (หารค่าใช้จ่ายกลุ่ม), Thai UI. Read this first; edit the
files named here instead of re-exploring.

## Stack & layout
- App lives in **`expense-tracking-ui/`** (Next.js 16 App Router, React 19,
  Tailwind v4, Supabase). Repo root also holds `supabase/` and `netlify.toml`.
- Path alias `@/*` → `expense-tracking-ui/*`.
- Main app is the client component **`app/page.tsx`** (the whole HaanHaan UI:
  group/member entry, balance card, add form, history, settings).
- Supabase: browser client `lib/supabase.ts` (cookie-based via `@supabase/ssr`),
  server clients `lib/supabase/server.ts` + `client.ts`, data layer `lib/db.ts`,
  balance math `lib/balances.ts`.

## Auth (shared cookie session)
- `/login` (`app/login/page.tsx` + `components/login-button.tsx`) = Google OAuth
  + email magic link, Thai UI. OAuth lands on `app/auth/callback/route.ts` → `/`.
- `middleware.ts`: if logged-in user hits `/login` → redirect `/`. The app at `/`
  gates itself: `app/page.tsx` redirects to `/login` when no session.
- `lib/auth.ts`: `getCurrentUser`, `onAuthChange`, `signOut`.

## Identity: email ↔ member ("จำเมล")
- `members.user_id` binds an auth user to a HaanHaan member (one per group).
- On login, `app/page.tsx` boot auto-enters the member whose `userId === auth uid`
  (skips the picker). Picking an unbound member calls `claimMember()` (`lib/db.ts`)
  via `bindMemberToMe()`. Settings → group member list has a "นี่คือฉัน" button
  (`handleClaimMember` + `releaseMember`).

## Expense vs income
- `Transaction.kind`: `'expense'` (default) | `'income'` (shared earnings split).
- Switch is in `components/expense/add-transaction.tsx` (รายจ่าย/รายรับ).
- `lib/balances.ts` inverts the sign for income (receiver owes others their share).
- `recent-list.tsx` and `settlement-modal.tsx` are income-aware (income excluded
  from spend totals/category breakdown).
- **TODO (not done yet):** `components/expense/history-view.tsx` and
  `summary-view.tsx` still treat income as an expense — they need the same
  `kind === 'income'` sign/exclusion handling.

## Supabase
- HaanHaan schema: `supabase/schema.sql` + migrations `0001`–`0003` (groups,
  members, invites, avatars, categories). Run these on a fresh project.
- Migrations `0004`–`0008` are a **separate double-entry "ledger" feature that was
  built then removed from the UI** (homes, accounts, profiles, etc.). The tables
  still exist in the DB but nothing in the app uses them. **Do not drop without
  asking** (destructive). `0008` adds `transactions.kind` — that one IS used.
- RLS is per-group/owner; `.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored).

## Deploy (Netlify)
- `netlify.toml`: base `expense-tracking-ui`, `npm run build`, publish `.next`,
  `@netlify/plugin-nextjs`, Node 20.
- **pnpm is pinned** to `10.30.3` (`packageManager` in package.json). The `hono`
  override lives in `pnpm-workspace.yaml` (NOT package.json — pnpm 11 ignores the
  old `pnpm.overrides` field). If you change deps, regenerate the lockfile with
  pnpm 10.30.3 (`corepack prepare pnpm@10.30.3 --activate`; `CI=true pnpm install`)
  or Netlify's frozen install fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- After deploy, add the prod URL to Supabase → Auth → Redirect URLs
  (`https://<site>.netlify.app/auth/callback`) and set the two env vars in Netlify.

## Gotchas
- Two pre-existing TS errors (`app/page.tsx` createGroup return type;
  `summary-view.tsx` recharts formatter). `next.config.mjs` has
  `typescript.ignoreBuildErrors: true`, so they don't block builds. Don't chase
  them unless asked.
- Branch `feat/multi-group-expense-sharing`, remote `tao1a5a-cyber/haanhaan-app`.
  Pushing from tools fails on auth — the user pushes manually.
- Dev server runs on port 3000 (often already up); the sandbox can't reach
  localhost, so verify via `npx tsc --noEmit`, not the browser.

## Commands (run inside `expense-tracking-ui/`)
- `npx tsc --noEmit` — typecheck (filter out the 2 known errors above)
- `CI=true pnpm install` — install with pnpm 10.30.3
- `npm run build` — production build
