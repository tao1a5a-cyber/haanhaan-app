# Easy Money 💸 — Couple's Expense Sharing (เต๋า & ไอซ์)

A mobile-first PWA for a couple to track shared expenses, loans, and monthly settlements.
**No build step** — plain HTML + Tailwind (CDN) + Vanilla JS + Supabase, deployed on Netlify.

## Features
- 50/50 split by default, with manual unequal split
- Quick-select category tags + quick-add fixed-amount buttons
- Slip/receipt upload to Supabase Storage
- Loans & repayments with real-time net-balance netting
- Monthly **Settle** to clear the books
- **Anti-Lazy soft penalty**: 5 records in a row by one person → the other earns a teasing "Lazy Point"
- LINE push notifications on new transactions / penalties (via Netlify Function)
- Dark / Light mode, Thai font (Prompt)

## File map
```
index.html                     dashboard + add-transaction + numpad UI
js/config.js                   ← PUT YOUR SUPABASE URL + ANON KEY HERE
js/supabaseClient.js           Supabase client (CDN ESM)
js/app.js                      all logic: auth, 50/50 split, 5-in-a-row, settle, netting
sql/schema.sql                 tables + RLS + triggers + helper functions
netlify/functions/line-notify.js   server-side LINE push
netlify.toml                   Netlify config
manifest.webmanifest           PWA manifest
```

## Setup

### 1. Supabase
1. Create a project at https://supabase.com
2. SQL Editor → paste & run `sql/schema.sql`
3. Storage → create a **public** bucket named `slips`
4. Project Settings → API → copy the **Project URL** and **anon public key**
5. Paste them into `js/config.js`

### 2. Create the couple
- Both เต๋า and ไอซ์ sign up in the app (a profile + group is auto-created by trigger).
- To put them in the **same group**, run the seed block at the bottom of `sql/schema.sql`
  with their real `auth.users` UUIDs (find them in Authentication → Users).

### 3. LINE notifications (optional)
- Create a LINE Messaging API channel, get the channel access token + your target id.
- In Netlify → Environment variables set `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_TARGET_ID`.

### 4. Deploy to Netlify
```bash
# from this folder
netlify deploy --prod      # or drag-and-drop the folder in the Netlify UI
```
No build command; publish directory is `.`, functions live in `netlify/functions`.

## Local dev
```bash
npx netlify dev     # serves the site + functions at http://localhost:8888
# or, without functions:
npx serve .
```

## How the core logic works
- **50/50 split** (`computeSplits` in `js/app.js`): for an expense, the non-payer owes
  `total / 2`; for a manual split, they owe the entered amount. Loans put the full amount
  on the borrower; repayments reduce the payer's outstanding debt.
- **Net balance** (`computeNetBalance`): sums all **unsettled** splits, signed so positive =
  partner owes you. Repayments flip the sign.
- **5-in-a-row** (`checkLazyStreak`): after each save, queries the last 5 transactions;
  if all were `created_by` you, your partner gets a Lazy Point (`add_lazy_point` RPC) and a
  teasing banner + LINE ping fire. It never blocks the save.
- **Settlement**: writes a `settlements` snapshot and flags all unsettled transactions
  `is_settled = true`.
```
```
