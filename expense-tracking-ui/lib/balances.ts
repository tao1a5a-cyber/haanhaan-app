import type { Member, Transaction } from "@/components/expense/types"

export type Transfer = { from: string; to: string; amount: number }

/** Round to 2 dp to avoid float dust in balances/transfers. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Split `amount` evenly across `ids`, distributing leftover satang one-by-one
 * so the shares sum to exactly `amount`.
 */
export function splitEqually(amount: number, ids: string[]): Record<string, number> {
  const rec: Record<string, number> = {}
  if (ids.length === 0) return rec
  const base = Math.floor((amount / ids.length) * 100) / 100
  let acc = 0
  for (const id of ids) { rec[id] = base; acc = round2(acc + base) }
  let rem = round2(amount - acc)
  let i = 0
  while (rem > 0.0001) {
    const id = ids[i % ids.length]
    rec[id] = round2(rec[id] + 0.01)
    rem = round2(rem - 0.01)
    i++
  }
  return rec
}

/**
 * Net balance per member over UNSETTLED transactions:
 *   balance(m) = (total m paid) − (total m owes via shares)
 * Positive → others owe this member; negative → this member owes.
 */
export function memberBalances(
  members: Member[],
  transactions: Transaction[],
): Record<string, number> {
  const bal: Record<string, number> = {}
  for (const m of members) bal[m.id] = 0

  for (const t of transactions) {
    if (t.settled) continue
    // Income flips the flow: the receiver owes others their share of the
    // earnings, so the whole entry is the negation of an expense.
    const sign = t.kind === "income" ? -1 : 1
    // payer fronted the whole amount (or received it, for income)
    bal[t.payerId] = (bal[t.payerId] ?? 0) + sign * t.amount
    // each member is responsible for (or entitled to) their share
    for (const [memberId, share] of Object.entries(t.shares ?? {})) {
      bal[memberId] = (bal[memberId] ?? 0) - sign * share
    }
  }

  for (const id of Object.keys(bal)) bal[id] = round2(bal[id])
  return bal
}

/** A single member's net (positive = they are owed). */
export function myNet(memberId: string, balances: Record<string, number>): number {
  return balances[memberId] ?? 0
}

/**
 * Greedy minimum-cash-flow: turn net balances into the fewest transfers.
 * Debtors (negative) pay creditors (positive) until everyone is settled.
 */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const creditors: { id: string; amt: number }[] = []
  const debtors: { id: string; amt: number }[] = []

  for (const [id, amt] of Object.entries(balances)) {
    if (amt > 0.005) creditors.push({ id, amt })
    else if (amt < -0.005) debtors.push({ id, amt: -amt })
  }
  // Largest first → fewer, cleaner transfers.
  creditors.sort((a, b) => b.amt - a.amt)
  debtors.sort((a, b) => b.amt - a.amt)

  const transfers: Transfer[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]
    const d = debtors[di]
    const pay = round2(Math.min(c.amt, d.amt))
    if (pay > 0) transfers.push({ from: d.id, to: c.id, amount: pay })
    c.amt = round2(c.amt - pay)
    d.amt = round2(d.amt - pay)
    if (c.amt <= 0.005) ci++
    if (d.amt <= 0.005) di++
  }
  return transfers
}
